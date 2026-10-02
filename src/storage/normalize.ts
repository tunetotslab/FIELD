import type { SoundRecord, Screen } from '../types';

/** Historical Git versions use the same audioBlob field. Keep every byte and
 * unknown property; never infer server publication from the visibility choice. */
export function normalizeRecording(record: SoundRecord): SoundRecord {
  return {
    ...record,
    schemaVersion: record.schemaVersion ?? 1,
    title: typeof record.title === 'string' ? record.title : '',
    emojis: Array.isArray(record.emojis) ? record.emojis : [],
    waveform: Array.isArray(record.waveform) ? record.waveform : [],
    styleId: record.styleId || 'grotesk',
    favorite: record.favorite === true,
    visibility: record.visibility || 'private',
  };
}

/** Early Library entries only stored city/country labels, without a server ID.
 * They must visit city selection instead of failing in /cities/resolve. */
export function hasResolvableCity(record: Pick<SoundRecord, 'location'>): boolean {
  const location = record.location;
  return !!(location?.city?.trim() && location.placeId &&
    /^[A-Z]{2}$/.test(location.countryCode || ''));
}

export function publicationStart(record: SoundRecord, destination: 'world' | 'group'): Screen {
  if (record.emojis.length !== 3 || record.emojis.some(emoji => typeof emoji !== 'string' || !emoji.trim() || emoji.length > 32)) return 'emoji';
  if (!record.title.trim() || record.title.length > 80) return 'title';
  return destination === 'group' || hasResolvableCity(record) ? 'visibility' : 'location';
}
