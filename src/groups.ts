import { API_URL } from "./config";
import type { SoundRecord } from "./types";
import { publicMetadata, FieldRequestError } from "./world";
import { preparePublicationAudio } from "./audio/publication";

export interface FieldGroup {
  id: string;
  name: string;
  role: "owner" | "member";
  joinCode?: string | null;
  telegramTitle?: string | null;
  messageThreadId?: number | null;
}

function auth() {
  return { Authorization: `tma ${window.Telegram?.WebApp?.initData || ""}` };
}

export async function fieldGroups(signal?: AbortSignal): Promise<FieldGroup[]> {
  const response = await fetch(`${API_URL}/groups`, {
    cache: 'no-store',
    headers: auth(),
    signal,
  });
  if (!response.ok) throw new FieldRequestError(response.status);
  return response.json();
}

export async function joinFieldGroup(code: string): Promise<FieldGroup> {
  const response = await fetch(`${API_URL}/groups/join`, {
    method: "POST",
    headers: { ...auth(), "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new FieldRequestError(response.status);
  return response.json();
}

export async function publishGroupSound(groupId: string, record: SoundRecord) {
  const prepared = await preparePublicationAudio(record);
  const form = new FormData();
  form.set(
    "metadata",
    JSON.stringify({ ...publicMetadata(prepared), id: record.id }),
  );
  form.set("audio", prepared.audioBlob, "sound.wav");
  const response = await fetch(
    `${API_URL}/groups/${encodeURIComponent(groupId)}/sounds`,
    {
      method: "POST",
      headers: auth(),
      body: form,
      signal: AbortSignal.timeout(60000),
    },
  );
  if (!response.ok) throw new FieldRequestError(response.status);
  return response.json() as Promise<{
    id: string;
    telegramDeliveryState: "delivered" | "failed" | "unconnected" | "pending";
  }>;
}
export async function retryGroupDelivery(groupId: string, id: string) {
  const response = await fetch(
    `${API_URL}/groups/${encodeURIComponent(groupId)}/sounds/${encodeURIComponent(id)}/retry`,
    { method: "POST", headers: auth(), signal: AbortSignal.timeout(60000) },
  );
  if (!response.ok) throw new FieldRequestError(response.status);
  return response.json() as Promise<{
    id: string;
    telegramDeliveryState: "delivered" | "failed" | "unconnected" | "pending";
  }>;
}
