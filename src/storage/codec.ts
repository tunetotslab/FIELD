import type { SoundRecord } from "../types";
import { normalizeRecording } from "./normalize";
import { StorageError } from "./errors";

type AudioData = {
  version: 1;
  render: { bytes: ArrayBuffer; type: string };
  original?: { bytes: ArrayBuffer; type: string };
};
type StoredSound = Partial<SoundRecord> & { __fieldAudioData?: AudioData };

/** WebKit can reject putting a retrieved Blob back into IndexedDB with
 * UnknownError. Persist sample bytes, never its temporary file-backed handle.
 * Read everything before the transaction; a failed read cannot alter the row. */
export async function encodeSound(sound: SoundRecord): Promise<StoredSound> {
  try {
    const render = {
      bytes: await sound.audioBlob.arrayBuffer(),
      type: sound.audioBlob.type,
    };
    const original = sound.originalBlob
      ? sound.originalBlob === sound.audioBlob
        ? render
        : {
            bytes: await sound.originalBlob.arrayBuffer(),
            type: sound.originalBlob.type,
          }
      : undefined;
    const {
      audioBlob: _audio,
      originalBlob: _original,
      ...metadata
    } = normalizeRecording(sound);
    return {
      ...metadata,
      __fieldAudioData: {
        version: 1,
        render,
        ...(original ? { original } : {}),
      },
    };
  } catch (error) {
    throw new StorageError("AUDIO_READ", error);
  }
}

/** Read old Blob rows in place, and materialize new byte rows into fresh Blobs.
 * Existing rows are migrated only on explicit save, without deleting originals. */
export function decodeSound(row: StoredSound): SoundRecord {
  const data = row.__fieldAudioData;
  if (!data) return normalizeRecording(row as SoundRecord);
  if (
    data.version !== 1 ||
    !(data.render?.bytes instanceof ArrayBuffer) ||
    (data.original && !(data.original.bytes instanceof ArrayBuffer))
  )
    throw new StorageError(
      "AUDIO_FORMAT",
      new Error("Unsupported stored audio"),
    );
  const { __fieldAudioData: _data, ...metadata } = row;
  return normalizeRecording({
    ...metadata,
    audioBlob: new Blob([data.render.bytes], { type: data.render.type }),
    ...(data.original
      ? {
          originalBlob: new Blob([data.original.bytes], {
            type: data.original.type,
          }),
        }
      : {}),
  } as SoundRecord);
}
