import {currentUserId,isAuthenticated} from '../auth/session';
import { FieldRequestError } from '../world';
import { soundsDb } from "./db";
import { publishSound, removeWorldSound } from "../world";
import type { SoundRecord, SoundLocation } from "../types";
import { newId } from '../id';
export function createWorldPublisher(
  repository = soundsDb,
  api: {
    publishSound: (
      record: SoundRecord,
    ) => Promise<{ id: string; location?: SoundLocation }>;
    removeWorldSound: (id: string) => Promise<unknown>;
  } = { publishSound, removeWorldSound },
  online = () => navigator.onLine,
  authenticated = isAuthenticated,
) {
  const uploads = new Map<string, Promise<SoundRecord>>();
  function uploadWorld(record: SoundRecord): Promise<SoundRecord> {
    const existing = uploads.get(record.id);
    if (existing) return existing;
    const work = (async () => {
      if (record.worldPublication?.ownerUserId && record.worldPublication.ownerUserId !== currentUserId()) throw new FieldRequestError(403, 'Publication owner required');
      if (record.worldPublication?.state === "published") return record;
      let next: SoundRecord & {
        worldPublication: NonNullable<SoundRecord["worldPublication"]>;
      } = {
        ...record,
        worldPublication: {
          ...record.worldPublication,
          ...(currentUserId() ? {ownerUserId:currentUserId()} : {}),
          clientId: record.worldPublication?.clientId || newId(),
          state: "pending",
        },
      };
      await repository.save(next);
      if (!online()) return next;
      try {
        const published = await api.publishSound(next);
        const latest = (await repository.getAll()).find(
          (r) => r.id === record.id,
        );
        if (!latest) return next; // Never resurrect a locally deleted recording.
        const result: SoundRecord = {
          ...latest,
          location: published.location || latest.location,
          worldPublication: {
            ...next.worldPublication,
            clientId: next.worldPublication.clientId,
            state: "published",
            serverId: published.id,
          },
        };
        await repository.save(result);
        return result;
      } catch (error) {
        const latest = (await repository.getAll()).find(
          (r) => r.id === record.id,
        );
        if (latest) {
          next = {
            ...latest,
            worldPublication: {
              ...next.worldPublication,
              state: online() ? "failed" : "pending",
            },
          };
          await repository.save(next);
        }
        throw error;
      }
    })();
    uploads.set(record.id, work);
    void work.finally(() => uploads.delete(record.id)).catch(() => {});
    return work;
  }
  async function unpublishWorld(record: SoundRecord) {
    if (record.worldPublication?.serverId)
      await api.removeWorldSound(record.worldPublication.serverId);
    const latest = (await repository.getAll()).find((r) => r.id === record.id);
    if (latest)
      await repository.save({ ...latest, worldPublication: undefined });
  }
  async function retryPendingWorld() {
    if (!online() || !authenticated()) return;
    for (const record of await repository.getAll()) {
      if (record.worldPublication?.state !== "pending") continue;
      if(record.worldPublication.ownerUserId && record.worldPublication.ownerUserId !== currentUserId())continue;
      try {await uploadWorld(record);} catch { /* Library offers retry. */ }
    }
  }
  return { uploadWorld, unpublishWorld, retryPendingWorld };
}
export const { uploadWorld, unpublishWorld, retryPendingWorld } =
  createWorldPublisher();
