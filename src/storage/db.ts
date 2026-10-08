import type { SoundRecord } from "../types";
import { encodeSound, decodeSound } from "./codec";
import { StorageError } from "./errors";
import { createLibrarySync } from "./librarySync";
import { isNativeApp } from "../native/runtime";
import { createNativeSoundRepository } from "./native";

const DB_NAME = "field-audio";
const STORE = "sounds";
const connections = new Map<string, Promise<IDBDatabase>>();
const transactionTails = new Map<string, Promise<void>>();
const RETRY_DELAYS = [60, 180, 500];

function forgetConnection(name: string, db?: IDBDatabase) {
  const opening = connections.get(name);
  if (!opening) return;
  connections.delete(name);
  if (db) {
    try {
      db.close();
    } catch {}
  }
}

function closeConnections() {
  for (const [name, opening] of connections) {
    connections.delete(name);
    void opening
      .then((db) => {
        try {
          db.close();
        } catch {}
      })
      .catch(() => {});
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", closeConnections);
  window.addEventListener("field-app-background", closeConnections);
  if (typeof document !== "undefined")
    document.addEventListener("visibilitychange", () => {
      // Reopen on both sides of an iOS WebView suspension. Some Telegram
      // versions report only the foreground transition before the next read.
      closeConnections();
    });
}

function openDb(name = DB_NAME): Promise<IDBDatabase> {
  const current = connections.get(name);
  if (current) return current;
  let opening: Promise<IDBDatabase>;
  opening = new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(name, 1);
    } catch (error) {
      connections.delete(name);
      reject(new StorageError("DB_OPEN", error));
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE))
        db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => {
      const db = request.result;
      const forget = () => {
        if (connections.get(name) === opening) connections.delete(name);
      };
      db.onclose = forget;
      db.onversionchange = () => {
        forget();
        db.close();
      };
      resolve(db);
    };
    request.onerror = () => {
      if (connections.get(name) === opening) connections.delete(name);
      reject(new StorageError("DB_OPEN", request.error));
    };
  });
  connections.set(name, opening);
  return opening;
}

function retryable(error: unknown) {
  const reason =
    error instanceof StorageError
      ? error.reason
      : error instanceof Error
        ? error.name
        : "";
  return ["UnknownError", "InvalidStateError", "AbortError"].includes(reason);
}

async function runTx<T>(
  name: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
  attempt = 0,
): Promise<T> {
  let db: IDBDatabase | undefined;
  try {
    db = await openDb(name);
    const connection = db;
    return await new Promise((resolve, reject) => {
      let transaction: IDBTransaction;
      let request: IDBRequest<T>;
      try {
        transaction = connection.transaction(STORE, mode);
        request = action(transaction.objectStore(STORE));
      } catch (error) {
        reject(error);
        return;
      }
      // A request success is not a durable transaction commit (quota/abort may follow).
      let result: T;
      request.onsuccess = () => {
        result = request.result;
      };
      const fail = (error: unknown) => {
        reject(error);
      };
      request.onerror = () => fail(request.error);
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () =>
        fail(transaction.error || new Error("Storage transaction aborted."));
      transaction.onerror = () =>
        fail(
          transaction.error ||
            new DOMException("IndexedDB transaction interrupted", "AbortError"),
        );
    });
  } catch (error) {
    const reconnect = retryable(error);
    if (reconnect) {
      if (db) forgetConnection(name, db);
      else connections.delete(name);
    }
    if (reconnect && attempt < RETRY_DELAYS.length) {
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_DELAYS[attempt]),
      );
      return runTx(name, mode, action, attempt + 1);
    }
    if (error instanceof StorageError) throw error;
    throw new StorageError(
      mode === "readwrite" ? "DB_WRITE" : "DB_READ",
      error,
    );
  }
}

function tx<T>(
  name: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  // Telegram's iOS WebView can lose the IndexedDB backing process while the
  // app is backgrounded. Keep one connection and serialize transactions so a
  // reconnect never races Library refresh, sync and an editor save.
  const previous = transactionTails.get(name) || Promise.resolve();
  const result = previous.then(
    () => runTx(name, mode, action),
    () => runTx(name, mode, action),
  );
  const tail = result.then(
    () => {},
    () => {},
  );
  transactionTails.set(name, tail);
  void tail.finally(() => {
    if (transactionTails.get(name) === tail) transactionTails.delete(name);
  });
  return result;
}

export function createSoundRepository(name = DB_NAME) {
  return {
    save: async (sound: SoundRecord) => {
      const row = await encodeSound(sound);
      const result = await tx(name, "readwrite", (store) => store.put(row));
      // Ask for eviction protection when supported. Saving succeeds only after
      // commit, independently of whether the browser grants this request.
      if (typeof navigator !== "undefined")
        void navigator.storage?.persist?.().catch(() => {});
      return result;
    },
    // Read-through migration: old raw rows remain intact until the user saves.
    getAll: async () =>
      (
        await tx<SoundRecord[]>(name, "readonly", (store) => store.getAll())
      ).map(decodeSound),
    remove: (id: string) => tx(name, "readwrite", (store) => store.delete(id)),
    clear: () => tx(name, "readwrite", (store) => store.clear()),
  };
}
export const soundsDb = isNativeApp()
  ? createNativeSoundRepository()
  : createLibrarySync(createSoundRepository());
