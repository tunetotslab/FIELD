import { fetchWithDeadline } from "../network";

type SessionBridge = {
  sessionRead(): Promise<{ value?: string }>;
  sessionWrite(options: { value: string }): Promise<void>;
  sessionRemove(): Promise<void>;
};
const isNativeRuntime = () =>
  Boolean(
    (
      window as typeof window & {
        Capacitor?: { isNativePlatform?: () => boolean };
      }
    ).Capacitor?.isNativePlatform?.(),
  );
const deviceSessionBridge: SessionBridge = {
  sessionRead: async () => {
    const bridge = (
      window as typeof window & { __fieldDeviceBridge?: SessionBridge }
    ).__fieldDeviceBridge;
    if (!bridge) throw Error("Native bridge unavailable");
    return bridge.sessionRead();
  },
  sessionWrite: async (options) => {
    const bridge = (
      window as typeof window & { __fieldDeviceBridge?: SessionBridge }
    ).__fieldDeviceBridge;
    if (!bridge) throw Error("Native bridge unavailable");
    return bridge.sessionWrite(options);
  },
  sessionRemove: async () => {
    const bridge = (
      window as typeof window & { __fieldDeviceBridge?: SessionBridge }
    ).__fieldDeviceBridge;
    if (!bridge) throw Error("Native bridge unavailable");
    return bridge.sessionRemove();
  },
};

export type FieldSession = {
  token: string;
  expiresAt: number;
  userId: number;
  displayName: string;
  provider: "telegram";
};
export type NativeSession = FieldSession;
export interface SessionStorage {
  read(): Promise<unknown>;
  write(value: FieldSession): Promise<void>;
  remove(): Promise<void>;
}

async function accountStore(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest,
) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("field-account", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("session");
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Error("Account storage unavailable"));
    request.onsuccess = () => resolve(request.result);
  });
  try {
    return await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction("session", mode);
      const request = action(tx.objectStore("session"));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () =>
        reject(tx.error || Error("Account storage failed"));
    });
  } finally {
    db.close();
  }
}

export const browserSessionStorage: SessionStorage = {
  read: () => accountStore("readonly", (store) => store.get("telegram")),
  write: async (value) => {
    await accountStore("readwrite", (store) => store.put(value, "telegram"));
  },
  remove: async () => {
    await accountStore("readwrite", (store) => store.delete("telegram"));
  },
};

export function nativeSessionStorage(
  bridge: SessionBridge = deviceSessionBridge,
): SessionStorage {
  return {
    read: async () => {
      const { value } = await bridge.sessionRead();
      if (!value) return undefined;
      try {
        return JSON.parse(value);
      } catch {
        return undefined;
      }
    },
    write: (value) => bridge.sessionWrite({ value: JSON.stringify(value) }),
    remove: () => bridge.sessionRemove(),
  };
}

export function createSessionStore(
  storage: SessionStorage = browserSessionStorage,
) {
  let session: FieldSession | undefined;
  let persistence = Promise.resolve();
  function persist(action: () => Promise<void>) {
    const next = persistence.then(action, action);
    persistence = next.catch(() => {});
    return next;
  }
  function valid(value: unknown): value is FieldSession {
    const data = value as FieldSession | undefined;
    return (
      !!data &&
      /^field_[A-Za-z0-9_-]{43}$/.test(data.token) &&
      Number.isSafeInteger(data.userId) &&
      data.userId > 0 &&
      data.provider === "telegram" &&
      typeof data.displayName === "string" &&
      data.displayName.length <= 100 &&
      Number.isFinite(data.expiresAt) &&
      data.expiresAt > Date.now()
    );
  }
  const currentSession = () =>
    session && session.expiresAt > Date.now() ? session : undefined;
  const isAuthenticated = () =>
    !!window.Telegram?.WebApp?.initData || !!currentSession();
  function currentUserId() {
    if (window.Telegram?.WebApp?.initData) {
      try {
        const id = JSON.parse(
          new URLSearchParams(window.Telegram.WebApp.initData).get("user") ||
            "{}",
        ).id;
        return Number.isSafeInteger(id) && id > 0 ? (id as number) : undefined;
      } catch {
        return undefined;
      }
    }
    return currentSession()?.userId;
  }
  function authenticationHeaders() {
    const raw = window.Telegram?.WebApp?.initData;
    return {
      Authorization: raw
        ? `tma ${raw}`
        : currentSession()
          ? `Bearer ${currentSession()!.token}`
          : "tma ",
    };
  }
  async function setSession(value: FieldSession | undefined) {
    if (value) {
      if (!valid(value)) throw Error("Invalid session");
      await persist(() => storage.write(value));
    } else {
      session = undefined;
      window.dispatchEvent(new Event("field-auth-changed"));
      await persist(() => storage.remove());
      return;
    }
    session = value;
    window.dispatchEvent(new Event("field-auth-changed"));
  }
  async function restoreSession() {
    const value = await storage.read();
    if (valid(value)) session = value;
    else if (value) {
      await storage.remove();
      session = undefined;
    }
  }
  async function authenticatedFetch(
    input: RequestInfo | URL,
    options: RequestInit = {},
    timeoutMs?: number,
  ) {
    const headers = new Headers(authenticationHeaders());
    new Headers(options.headers).forEach((value, key) =>
      headers.set(key, value),
    );
    const used = headers.get("Authorization");
    const response = await fetchWithDeadline(
      input,
      { ...options, headers },
      timeoutMs,
    );
    if (
      response.status === 401 &&
      session &&
      used === `Bearer ${session.token}`
    ) {
      session = undefined;
      await persist(() => storage.remove()).catch(() => {});
      window.dispatchEvent(new Event("field-auth-changed"));
    }
    return response;
  }
  return {
    currentSession,
    currentUserId,
    isAuthenticated,
    authenticationHeaders,
    setSession,
    restoreSession,
    authenticatedFetch,
  };
}

export function createNativeSessionStore(
  bridge: SessionBridge = deviceSessionBridge,
  native: () => boolean = isNativeRuntime,
) {
  const store = createSessionStore(
    native() ? nativeSessionStorage(bridge) : browserSessionStorage,
  );
  return {
    ...store,
    setNativeSession: store.setSession,
    restoreNativeSession: store.restoreSession,
  };
}

const sessionStore = createSessionStore(
  isNativeRuntime() ? nativeSessionStorage() : browserSessionStorage,
);
export const {
  currentSession,
  currentUserId,
  isAuthenticated,
  authenticationHeaders,
  setSession,
  restoreSession,
  authenticatedFetch,
} = sessionStore;
export const setNativeSession = setSession;
export const restoreNativeSession = restoreSession;
