import type { SoundRecord } from "../types";
import { encodeSound, decodeSound } from "./codec";
import { StorageError } from "./errors";

const DB_NAME = "field-audio";
const STORE = "sounds";

function openDb(name = DB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(name, 1);
    } catch (error) {
      reject(new StorageError("DB_OPEN", error));
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE))
        db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new StorageError("DB_OPEN", request.error));
  });
}

async function tx<T>(
  name: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb(name);
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction;
    let request: IDBRequest<T>;
    try {
      transaction = db.transaction(STORE, mode);
      request = action(transaction.objectStore(STORE));
    } catch (error) {
      db.close();
      reject(
        new StorageError(mode === "readwrite" ? "DB_WRITE" : "DB_READ", error),
      );
      return;
    }
    // A request success is not a durable transaction commit (quota/abort may follow).
    let result: T;
    request.onsuccess = () => {
      result = request.result;
    };
    const fail = (error: unknown) => {
      db.close();
      reject(
        new StorageError(mode === "readwrite" ? "DB_WRITE" : "DB_READ", error),
      );
    };
    request.onerror = () => fail(request.error);
    transaction.oncomplete = () => {
      db.close();
      resolve(result);
    };
    transaction.onabort = () =>
      fail(transaction.error || new Error("Storage transaction aborted."));
    transaction.onerror = () => fail(transaction.error);
  });
}

export function createSoundRepository(name = DB_NAME) {
  return {
    save: async (sound: SoundRecord) => {
      const row = await encodeSound(sound);
      return tx(name, "readwrite", (store) => store.put(row));
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
export const soundsDb = createSoundRepository();
