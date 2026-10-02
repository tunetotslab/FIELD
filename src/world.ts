import { API_URL } from "./config";
import type { SoundRecord, SoundLocation } from "./types";
export type WorldSound = Pick<
  SoundRecord,
  "id" | "title" | "emojis" | "duration" | "createdAt" | "styleId" | "waveform"
> & { location: SoundLocation };
export type WorldCity = SoundLocation & { id: string; count: number };
export type WorldPage = { items: WorldSound[]; nextCursor: string | null };
export const reportReasons = [
  "privacy",
  "abuse",
  "copyright",
  "other",
] as const;
export function publicMetadata(record: SoundRecord) {
  return {
    id: record.worldPublication?.clientId || record.id,
    title: record.title,
    emojis: record.emojis,
    duration: record.duration,
    styleId: record.styleId,
    effect: record.effect,
    waveform: record.waveform,
    location: record.location,
  };
}
export async function worldRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `tma ${window.Telegram?.WebApp?.initData || ""}`,
      ...options.headers,
    },
    signal: options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(60000)])
      : AbortSignal.timeout(60000),
  });
  if (!response.ok)
    throw new Error(`FIELD request failed (${response.status})`);
  return response.json();
}
export async function publishSound(record: SoundRecord) {
  const form = new FormData();
  form.set("metadata", JSON.stringify(publicMetadata(record)));
  form.set("audio", record.audioBlob, "sound.wav");
  return worldRequest<{ id: string }>("/world", { method: "POST", body: form });
}
export function worldCities(signal: AbortSignal) {
  return worldRequest<WorldCity[]>("/world/cities", { signal });
}
export function worldSounds(
  city: string,
  cursor: string | null,
  signal: AbortSignal,
) {
  return worldRequest<WorldPage>(
    `/world?${new URLSearchParams({ city, ...(cursor ? { cursor } : {}) })}`,
    { signal },
  );
}
export function removeWorldSound(id: string) {
  return worldRequest(`/world/${encodeURIComponent(id)}`, { method: "DELETE" });
}
export function reportWorldSound(
  id: string,
  reason: (typeof reportReasons)[number],
) {
  return worldRequest(`/world/${encodeURIComponent(id)}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}
export async function worldAudio(id: string, signal?: AbortSignal) {
  const response = await fetch(`${API_URL}/audio/${encodeURIComponent(id)}`, {
    headers: {
      Authorization: `tma ${window.Telegram?.WebApp?.initData || ""}`,
    },
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
      : AbortSignal.timeout(30000),
  });
  if (!response.ok) throw Error("Audio unavailable");
  return response.blob();
}
