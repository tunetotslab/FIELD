import { isNativeApp } from "./runtime";
export async function subscribeNativeLifecycle() {
  if (!isNativeApp()) return () => {};
  const { App: NativeApp } = await import("@capacitor/app");
  const listener = await NativeApp.addListener(
    "appStateChange",
    ({ isActive }) => {
      if (isActive) {
        window.dispatchEvent(new Event("focus"));
        if (navigator.onLine) window.dispatchEvent(new Event("online"));
      } else window.dispatchEvent(new Event("field-app-background"));
    },
  );
  return () => {
    void listener.remove();
  };
}
