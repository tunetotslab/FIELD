import { API_URL } from './config';
import type { SoundRecord } from './types';
function auth() { return { Authorization: `tma ${window.Telegram?.WebApp?.initData || ''}` }; }
export async function publishSound(record: SoundRecord) {
  const form = new FormData();
  const { audioBlob, ...metadata } = record;
  form.set('metadata', JSON.stringify(metadata));
  form.set('audio', audioBlob, 'sound.wav');
  const response = await fetch(`${API_URL}/world`, { method: 'POST', headers: auth(), body: form, signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error('Publishing failed');
  return await response.json() as { id: string };
}
export async function worldSounds(signal: AbortSignal): Promise<SoundRecord[]> {
  const response = await fetch(`${API_URL}/world`, { headers: auth(), signal });
  if (!response.ok) throw new Error('World unavailable');
  return response.json();
}
export async function worldAudio(id: string) {
  const response = await fetch(`${API_URL}/audio/${encodeURIComponent(id)}`, {headers:auth(),signal:AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error('Audio unavailable');
  return response.blob();
}
