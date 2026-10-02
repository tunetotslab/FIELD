import { isNativeApp, device } from "../native/runtime";
export type NativeSession = {
  token: string;
  expiresAt: number;
  userId: number;
  displayName: string;
  provider: "telegram" | "apple";
};
let session: NativeSession | undefined;
export function currentSession() {
  return session && session.expiresAt > Date.now() ? session : undefined;
}
export function isAuthenticated() {
  return !!window.Telegram?.WebApp?.initData || !!currentSession();
}
export function authenticationHeaders(): { Authorization: string } {
  const telegram = window.Telegram?.WebApp?.initData;
  return {
    Authorization: telegram
      ? `tma ${telegram}`
      : currentSession()
        ? `Bearer ${currentSession()!.token}`
        : "tma ",
  };
}
export async function setNativeSession(value: NativeSession | undefined) {
  if (!isNativeApp()) throw Error("Native session requires the iOS app");
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
    await device.sessionWrite({ value: JSON.stringify(value) });
  } else await device.sessionRemove();
  session = value;
  window.dispatchEvent(new Event("field-auth-changed"));
}
export async function restoreNativeSession() {
  if (!isNativeApp()) return;
  const { value } = await device.sessionRead();
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
    else await device.sessionRemove();
  } catch {
    await device.sessionRemove();
  }
}
