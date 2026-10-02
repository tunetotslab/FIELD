import { fetchWithDeadline } from "../network";
import { isNativeApp, device, type DeviceBridge } from "../native/runtime";
export type NativeSession = {
  token: string;
  expiresAt: number;
  userId: number;
  displayName: string;
  provider: "telegram" | "apple";
};
export function createNativeSessionStore(
  bridge: Pick<
    DeviceBridge,
    "sessionRead" | "sessionWrite" | "sessionRemove"
  > = device,
  native = isNativeApp,
) {
  let session: NativeSession | undefined;
  function currentSession() {
    return session && session.expiresAt > Date.now() ? session : undefined;
  }
  function isAuthenticated() {
    return !!window.Telegram?.WebApp?.initData || !!currentSession();
  }
  function authenticationHeaders(): { Authorization: string } {
    const telegram = window.Telegram?.WebApp?.initData;
    return {
      Authorization: telegram
        ? `tma ${telegram}`
        : currentSession()
          ? `Bearer ${currentSession()!.token}`
          : "tma ",
    };
  }
  async function setNativeSession(value: NativeSession | undefined) {
    if (!native()) throw Error("Native session requires the iOS app");
    if (value) {
      if (
        !/^field_[A-Za-z0-9_-]{43}$/.test(value.token) ||
        !Number.isSafeInteger(value.userId) ||
        value.userId <= 0 ||
        value.provider !== "telegram" ||
        typeof value.displayName !== "string" ||
        value.displayName.length > 100 ||
        !Number.isFinite(value.expiresAt) ||
        value.expiresAt <= Date.now()
      )
        throw Error("Invalid session");
      await bridge.sessionWrite({ value: JSON.stringify(value) });
    } else await bridge.sessionRemove();
    session = value;
    window.dispatchEvent(new Event("field-auth-changed"));
  }
  async function restoreNativeSession() {
    if (!native()) return;
    const { value } = await bridge.sessionRead();
    if (!value) return;
    try {
      const data = JSON.parse(value) as NativeSession;
      if (
        /^field_[A-Za-z0-9_-]{43}$/.test(data.token) &&
        Number.isSafeInteger(data.userId) &&
        data.userId > 0 &&
        data.provider === "telegram" &&
        typeof data.displayName === "string" &&
        data.displayName.length <= 100 &&
        data.expiresAt > Date.now()
      )
        session = data;
      else await bridge.sessionRemove();
    } catch {
      await bridge.sessionRemove();
    }
  }

  /** A rejected old request must never log out a newer account. Capture the token
   * per request; invalidate only a matching native session, keeping audio intact. */
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
      native() &&
      used === `Bearer ${currentSession()?.token}` &&
      currentSession()
    ) {
      await setNativeSession(undefined).catch(() => {});
    }
    return response;
  }

  return {
    currentSession,
    isAuthenticated,
    authenticationHeaders,
    setNativeSession,
    restoreNativeSession,
    authenticatedFetch,
  };
}
export const {
  currentSession,
  isAuthenticated,
  authenticationHeaders,
  setNativeSession,
  restoreNativeSession,
  authenticatedFetch,
} = createNativeSessionStore();
