import {authenticationHeaders} from './auth/session';
import { API_URL } from "./config";
import type { SoundRecord, SoundLocation } from "./types";
import { preparePublicationAudio, PublicationAudioError } from "./audio/publication";
import { fetchWithDeadline, NetworkRequestError } from './network';
import { StorageError } from './storage/errors';
export type WorldSound = Pick<
  SoundRecord,
  "id" | "title" | "emojis" | "duration" | "createdAt" | "styleId" | "waveform"
> & { location: SoundLocation; likes?: number; liked?: boolean };
export type WorldCity = SoundLocation & { id: string; count: number };
export type WorldPage = { items: WorldSound[]; nextCursor: string | null };
export const reportReasons = [
  "privacy",
  "abuse",
  "copyright",
  "other",
] as const;
export class FieldRequestError extends Error {
  constructor(public readonly status: number, public readonly reason = '') {
    super(`FIELD request failed (${status})`);
  }
}
export async function requestError(response: Response): Promise<FieldRequestError> {
  let reason = '';
  try { const body = await response.json(); if (typeof body.error === 'string') reason = body.error.slice(0, 150); } catch {}
  return new FieldRequestError(response.status, reason);
}
export function publicationErrorMessage(error: unknown, t: (key: 'sessionExpired' | 'publicationStorageFailed' | 'publicationAudioFailed' | 'publicationNetworkFailed' | 'publicationTooLarge' | 'publicationCityFailed' | 'publicationMetadataFailed' | 'publicationAccessFailed' | 'publicationLimitFailed' | 'publicationServiceFailed') => string): string {
  if (error instanceof StorageError) return `${t('publicationStorageFailed')} [${error.step}:${error.reason}]`;
  if (error instanceof PublicationAudioError) return `${t('publicationAudioFailed')} [${error.step}]`;
  if (error instanceof NetworkRequestError) return `${t('publicationNetworkFailed')} [${error.step}:${error.kind}]`;
  if (!(error instanceof FieldRequestError)) return `${t('publicationServiceFailed')} [LOCAL:${error instanceof Error && /^[a-zA-Z]{1,30}$/.test(error.name) ? error.name : 'Error'}]`;
  const key = error.status === 401 ? 'sessionExpired' : error.status === 413 ? 'publicationTooLarge' : error.status === 429 ? 'publicationLimitFailed' : error.status === 403 ? 'publicationAccessFailed' : error.reason.toLowerCase().includes('city') ? 'publicationCityFailed' : error.status === 400 ? 'publicationMetadataFailed' : 'publicationServiceFailed';
  return `${t(key)} (${error.status})`;
}
export const isAuthenticationError = (error: unknown) =>
  error instanceof FieldRequestError && error.status === 401;
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
  const response = await fetchWithDeadline(`${API_URL}${path}`, {
    ...options,
    cache: 'no-store',
    headers: {
      ...authenticationHeaders(),
      ...options.headers,
    },
  });
  if (!response.ok)
    throw await requestError(response);
  try {return await response.json();} catch {throw new FieldRequestError(response.status, 'Invalid service response');}
}
export async function publishSound(record: SoundRecord) {
  const auth = authenticationHeaders();
  const prepared = await preparePublicationAudio(record);
  if (!record.location) throw Error("City required");
  const location = await worldRequest<SoundLocation>("/cities/resolve", {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      placeId: record.location.placeId,
      city: record.location.city,
      countryCode: record.location.countryCode,
      region: record.location.region,
      language: (() => {try {return localStorage.getItem('field-locale') || 'en';} catch {return 'en';}})(),
    }),
  });
  const form = new FormData();
  form.set(
    "metadata",
    JSON.stringify({ ...publicMetadata(prepared), location }),
  );
  form.set("audio", prepared.audioBlob, "sound.wav");
  const result = await worldRequest<{ id: string }>("/world", {
    method: "POST",
    headers: auth,
    body: form,
  });
  return { ...result, location };
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
export function likeWorldSound(id: string, liked: boolean) {
  return worldRequest<{ likes: number; liked: boolean }>(
    `/world/${encodeURIComponent(id)}/likes`,
    { method: liked ? "POST" : "DELETE" },
  );
}
export function worldDownload(id: string) {
  return worldRequest<{ url: string }>(
    `/world/${encodeURIComponent(id)}/download`,
    { method: "POST" },
  );
}
export function reportWorldSound(
  id: string,
  reason: (typeof reportReasons)[number],
) {
  return worldRequest(`/world/${encodeURIComponent(id)}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reason,
      language: localStorage.getItem("field-locale") || "en",
    }),
  });
}
export async function worldAudio(id: string, signal?: AbortSignal) {
  const response = await fetchWithDeadline(`${API_URL}/audio/${encodeURIComponent(id)}`, {
    cache: 'no-store',
    headers: {
      ...authenticationHeaders(),
    },
    signal,
  }, 30000);
  if (!response.ok) throw new FieldRequestError(response.status);
  return response.blob();
}
