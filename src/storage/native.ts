import type { SoundRecord } from "../types";
import {
  device,
  bytesToBase64,
  base64ToBytes,
  type DeviceBridge,
} from "../native/runtime";
import { normalizeRecording } from "./normalize";
import { StorageError } from "./errors";

/** iOS audio lives in protected Application Support files; SQLite contains
 * metadata and content hashes only. A failed write cannot replace a saved row. */
export function createNativeSoundRepository(bridge: DeviceBridge = device) {
  return {
    async save(sound: SoundRecord) {
      try {
        const renderBase64 = bytesToBase64(await sound.audioBlob.arrayBuffer());
        const originalBase64 = sound.originalBlob
          ? bytesToBase64(await sound.originalBlob.arrayBuffer())
          : undefined;
        const { audioBlob, originalBlob, ...metadata } =
          normalizeRecording(sound);
        await bridge.saveSound({
          id: sound.id,
          metadata: JSON.stringify({
            record: metadata,
            renderType: audioBlob.type,
            originalType: originalBlob?.type,
          }),
          renderBase64,
          originalBase64,
        });
        return sound.id;
      } catch (error) {
        throw new StorageError("NATIVE_WRITE", error);
      }
    },
    async getAll(): Promise<SoundRecord[]> {
      try {
        const { ids } = await bridge.listSounds();
        const records: SoundRecord[] = [];
        // Decode one file at a time instead of keeping all base64 copies alive.
        for (const id of ids) {
          const row = await bridge.loadSound({ id });
          const data = JSON.parse(row.metadata);
          if (data.record?.id !== id) throw Error("Invalid native metadata");
          records.push(
            normalizeRecording({
              ...data.record,
              audioBlob: new Blob([base64ToBytes(row.renderBase64)], {
                type: data.renderType,
              }),
              ...(row.originalBase64
                ? {
                    originalBlob: new Blob(
                      [base64ToBytes(row.originalBase64)],
                      { type: data.originalType },
                    ),
                  }
                : {}),
            }),
          );
        }
        return records;
      } catch (error) {
        throw new StorageError("NATIVE_READ", error);
      }
    },
    async remove(id: string) {
      try {
        await bridge.removeSound({ id });
      } catch (error) {
        throw new StorageError("NATIVE_REMOVE", error);
      }
    },
    async clear() {
      throw new StorageError(
        "NATIVE_REMOVE",
        new Error("Bulk native deletion is disabled"),
      );
    },
  };
}
