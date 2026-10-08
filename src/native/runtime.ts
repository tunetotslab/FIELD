export const isNativeApp = () =>
  Boolean(
    (
      window as typeof window & {
        Capacitor?: { isNativePlatform?: () => boolean };
      }
    ).Capacitor?.isNativePlatform?.(),
  );
export interface DeviceBridge {
  openTelegram(options: { url: string }): Promise<void>;
  listSounds(): Promise<{ ids: string[] }>;
  loadSound(options: {
    id: string;
  }): Promise<{
    metadata: string;
    renderBase64: string;
    originalBase64?: string;
  }>;
  saveSound(options: {
    id: string;
    metadata: string;
    renderBase64: string;
    originalBase64?: string;
  }): Promise<void>;
  removeSound(options: { id: string }): Promise<void>;
  sessionRead(): Promise<{ value?: string }>;
  sessionWrite(options: { value: string }): Promise<void>;
  sessionRemove(): Promise<void>;
  shareWav(options: {
    base64: string;
    name: string;
    action: "export" | "share";
  }): Promise<{ cancelled: boolean }>;
}
const loadDevice = async () =>
  (await import("@capacitor/core")).registerPlugin<DeviceBridge>("FieldDevice");
export const device = new Proxy({} as DeviceBridge, {
  get: (_target, property: keyof DeviceBridge) =>
    async (...args: never[]) => {
      const plugin = await loadDevice();
      return (plugin[property] as (...values: never[]) => Promise<unknown>)(
        ...args,
      );
    },
});
(
  window as typeof window & { __fieldDeviceBridge?: DeviceBridge }
).__fieldDeviceBridge = device;

export function bytesToBase64(bytes: ArrayBuffer): string {
  const data = new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < data.length; i += 32768)
    binary += String.fromCharCode(...data.subarray(i, i + 32768));
  return btoa(binary);
}
export function base64ToBytes(value: string): ArrayBuffer {
  const raw = atob(value),
    data = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) data[i] = raw.charCodeAt(i);
  return data.buffer;
}
