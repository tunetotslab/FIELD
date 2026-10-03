import type { SoundRecord } from "../types";
import {
  currentUserId,
  authenticationHeaders,
  authenticatedFetch,
} from "../auth/session";
import { API_URL } from "../config";
import { newId } from "../id";
type Sync = NonNullable<SoundRecord["librarySync"]>;
export type LibraryItem = {
  id: string;
  revision: string;
  mutationId: string;
  metadata: Omit<
    SoundRecord,
    "id" | "audioBlob" | "originalBlob" | "librarySync"
  >;
  renderHash: string;
  originalHash: string | null;
  renderType: string;
  originalType: string | null;
  deleted: boolean;
  updatedAt: number;
};
type Context = {
  userId: number;
  headers: Record<string, string>;
  signal: AbortSignal;
};
export interface LibraryApi {
  list(
    ctx: Context,
    cursor?: string,
  ): Promise<{ userId: number; items: LibraryItem[]; cursor: string | null }>;
  write(ctx: Context, sound: SoundRecord): Promise<LibraryItem>;
  audio(
    ctx: Context,
    item: LibraryItem,
    part: "render" | "original",
  ): Promise<Blob>;
}
export class LibrarySyncError extends Error {
  constructor(public status: number) {
    super(`LIBRARY:${status}`);
  }
}
async function checksum(blob: Blob) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()),
    ),
  ]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
async function response(ctx: Context, path: string, options: RequestInit = {}) {
  const r = await authenticatedFetch(
    `${API_URL}/library${path}`,
    { ...options, headers: ctx.headers, signal: ctx.signal, cache: "no-store" },
    120000,
  );
  if (!r.ok) throw new LibrarySyncError(r.status);
  return r;
}
const api: LibraryApi = {
  async list(ctx, cursor) {
    return (
      await response(ctx, cursor ? `?cursor=${encodeURIComponent(cursor)}` : "")
    ).json();
  },
  async write(ctx, sound) {
    const sync = sound.librarySync!;
    const form = new FormData();
    const manifest: Record<string, unknown> = {
      baseRevision: sync.revision || null,
      mutationId: sync.mutationId,
    };
    if (!sync.deleted) {
      const {
        audioBlob,
        originalBlob,
        librarySync: _sync,
        id: _id,
        ...metadata
      } = sound;
      const renderHash = await checksum(audioBlob);
      const originalHash = originalBlob ? await checksum(originalBlob) : null;
      Object.assign(manifest, {
        metadata,
        renderHash,
        originalHash,
        renderType: audioBlob.type,
        originalType: originalBlob?.type,
      });
      if (!sync.revision || sync.renderHash !== renderHash)
        form.set("render", audioBlob, "render");
      if (
        originalBlob &&
        (!sync.revision || sync.originalHash !== originalHash)
      )
        form.set("original", originalBlob, "original");
    }
    form.set("manifest", JSON.stringify(manifest));
    const result = await (
      await response(ctx, `/${sync.recordId}`, {
        method: sync.deleted ? "DELETE" : "POST",
        body: form,
      })
    ).json();
    if (result.userId !== ctx.userId) throw new LibrarySyncError(403);
    return result.item;
  },
  async audio(ctx, item, part) {
    const blob = await (
      await response(ctx, `/${item.id}/${part}?revision=${item.revision}`)
    ).blob();
    if (
      (await checksum(blob)) !==
      (part === "render" ? item.renderHash : item.originalHash)
    )
      throw new LibrarySyncError(502);
    return new Blob([blob], {
      type: (part === "render" ? item.renderType : item.originalType) || "",
    });
  },
};
type Repository = {
  save: (sound: SoundRecord) => Promise<unknown>;
  getAll: () => Promise<SoundRecord[]>;
  remove: (id: string) => Promise<unknown>;
  clear: () => Promise<unknown>;
};
export function createLibrarySync(
  repository: Repository,
  remote: LibraryApi = api,
  owner = () => (typeof window === "undefined" ? undefined : currentUserId()),
  notify = (kind: string) => {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(kind));
  },
) {
  let tail = Promise.resolve();
  const queued = <T>(action: () => Promise<T>) => {
    const result = tail.then(action, action);
    tail = result.then(
      () => {},
      () => {},
    );
    return result;
  };
  let controller: AbortController | undefined,
    inFlight: Promise<void> | undefined;
  let rerun = false;
  let state: { busy: boolean; error?: number; completedAt?: number } = {
    busy: false,
  };
  const dirty = (r: SoundRecord) =>
    r.librarySync?.mutationId !== r.librarySync?.syncedMutationId;
  const alive = (ctx: Context) => owner() === ctx.userId && !ctx.signal.aborted;
  const all = () => repository.getAll();
  const emit = () => notify("field-library-changed");
  const getAll = async () =>
    (await all()).filter((r) =>
      r.librarySync
        ? r.librarySync.ownerUserId === owner() && !r.librarySync.deleted
        : !r.worldPublication?.ownerUserId ||
          r.worldPublication.ownerUserId === owner(),
    );
  const save = (sound: SoundRecord) =>
    queued(async () => {
      const latest = (await all()).find((r) => r.id === sound.id);
      let sync = latest?.librarySync;
      if (sync && sync.ownerUserId !== owner()) throw new LibrarySyncError(403);
      if (
        !sync &&
        latest?.worldPublication?.ownerUserId &&
        latest.worldPublication.ownerUserId !== owner()
      )
        throw new LibrarySyncError(403);
      // Legacy/unowned rows are bound only by the explicit migration action.
      if (!latest && owner())
        sync = {
          ownerUserId: owner()!,
          recordId: newId(),
          mutationId: newId(),
        };
      const result = await repository.save({
        ...sound,
        librarySync: sync
          ? { ...sync, deleted: false, mutationId: newId() }
          : undefined,
      });
      emit();
      if (sync) notify("field-library-pending");
      return result;
    });
  const remove = (id: string) =>
    queued(async () => {
      const row = (await all()).find((r) => r.id === id);
      if (row?.librarySync) {
        if (row.librarySync.ownerUserId !== owner())
          throw new LibrarySyncError(403);
        // A durable tombstone prevents an offline deletion being resurrected.
        // Keep the cached bytes; no remote event wipes local user audio.
        await repository.save({
          ...row,
          librarySync: {
            ...row.librarySync,
            deleted: true,
            mutationId: newId(),
          },
        });
        notify("field-library-pending");
      } else await repository.remove(id);
      emit();
    });
  const adoptExisting = () =>
    queued(async () => {
      const userId = owner();
      if (!userId) throw new LibrarySyncError(401);
      let failed: unknown;
      for (const row of await all()) {
        if (owner() !== userId) throw new LibrarySyncError(401);
        if (
          !row.librarySync &&
          (!row.worldPublication?.ownerUserId ||
            row.worldPublication.ownerUserId === userId)
        )
          try {
            await repository.save({
              ...row,
              librarySync: {
                ownerUserId: userId,
                recordId: newId(),
                mutationId: newId(),
              },
            });
          } catch (error) {
            failed ??= error;
          }
      }
      emit();
      notify("field-library-pending");
      if (failed) throw failed;
    });
  async function acknowledge(
    ctx: Context,
    source: SoundRecord,
    item: LibraryItem,
  ) {
    await queued(async () => {
      if (!alive(ctx)) return;
      const latest = (await all()).find((r) => r.id === source.id);
      if (
        !latest?.librarySync ||
        latest.librarySync.recordId !== item.id ||
        latest.librarySync.ownerUserId !== ctx.userId
      )
        return;
      const same =
        latest.librarySync.mutationId === source.librarySync!.mutationId;
      await repository.save({
        ...latest,
        librarySync: {
          ...latest.librarySync,
          revision: item.revision,
          renderHash: item.renderHash,
          originalHash: item.originalHash,
          ...(same
            ? {
                syncedMutationId: latest.librarySync.mutationId,
                deleted: item.deleted,
              }
            : {}),
        },
      });
      emit();
    });
  }
  async function run(ctx: Context) {
    const items = new Map<string, LibraryItem>();
    let cursor: string | undefined;
    do {
      const page = await remote.list(ctx, cursor);
      if (page.userId !== ctx.userId) throw new LibrarySyncError(403);
      for (const item of page.items) items.set(item.id, item);
      cursor = page.cursor || undefined;
    } while (cursor && alive(ctx));
    if (!alive(ctx)) return;
    let firstError: unknown;
    for (const original of await all()) {
      if (!alive(ctx)) return;
      if (original.librarySync?.ownerUserId !== ctx.userId || !dirty(original))
        continue;
      let local = original;
      try {
        const sync = local.librarySync!;
        const current = items.get(sync.recordId);
        if (current?.mutationId === sync.mutationId) {
          await acknowledge(ctx, local, current);
          continue;
        }
        if (sync.deleted && !sync.revision && !current) {
          await queued(async () => {
            const latest = (await all()).find((r) => r.id === local.id);
            if (
              alive(ctx) &&
              latest?.librarySync?.mutationId === sync.mutationId
            )
              await repository.save({
                ...latest,
                librarySync: { ...sync, syncedMutationId: sync.mutationId },
              });
          });
          continue;
        }
        if (current && current.revision !== (sync.revision || null)) {
          if (sync.deleted) {
            if (current.deleted) {
              await acknowledge(ctx, local, current);
              continue;
            }
            // Preserve the other device's concurrent edit as a private copy,
            // before applying the requested deletion to the original identity.
            const audioBlob = await remote.audio(ctx, current, "render");
            const originalBlob = current.originalHash
              ? await remote.audio(ctx, current, "original")
              : undefined;
            const copy: SoundRecord = {
              ...current.metadata,
              id: newId(),
              audioBlob,
              originalBlob,
              visibility: "private",
              worldPublication: undefined,
              groupPublication: undefined,
              librarySync: {
                ownerUserId: ctx.userId,
                recordId: newId(),
                mutationId: newId(),
              },
            };
            if (!alive(ctx)) return;
            await queued(() => repository.save(copy));
            const copied = await remote.write(ctx, copy);
            items.set(copied.id, copied);
            await acknowledge(ctx, copy, copied);
            local = await queued(async () => {
              const latest = (await all()).find((r) => r.id === local.id);
              if (
                !alive(ctx) ||
                latest?.librarySync?.mutationId !== sync.mutationId
              )
                return local;
              const next = {
                ...latest,
                librarySync: {
                  ...latest.librarySync,
                  revision: current.revision,
                },
              };
              await repository.save(next);
              return next;
            });
          } else {
            local = await queued(async () => {
              const latest = (await all()).find((r) => r.id === local.id);
              if (
                !alive(ctx) ||
                latest?.librarySync?.mutationId !== sync.mutationId
              )
                return local;
              // Preserve both edits rather than overwrite an offline version.
              const copy = {
                ...latest,
                visibility: "private" as const,
                worldPublication: undefined,
                groupPublication: undefined,
                librarySync: {
                  ownerUserId: ctx.userId,
                  recordId: newId(),
                  mutationId: newId(),
                },
              };
              await repository.save(copy);
              emit();
              return copy;
            });
          }
        }
        if (!alive(ctx)) return;
        const written = await remote.write(ctx, local);
        items.set(written.id, written);
        await acknowledge(ctx, local, written);
      } catch (error) {
        firstError ??= error;
      }
    }
    for (const item of items.values()) {
      if (!alive(ctx)) return;
      try {
        const existing = (await all()).find(
          (r) =>
            r.librarySync?.ownerUserId === ctx.userId &&
            r.librarySync.recordId === item.id,
        );
        if (
          existing &&
          (dirty(existing) || existing.librarySync?.revision === item.revision)
        )
          continue;
        if (item.deleted) {
          if (existing)
            await queued(async () => {
              const latest = (await all()).find((r) => r.id === existing.id);
              if (
                alive(ctx) &&
                latest &&
                latest.librarySync?.mutationId ===
                  existing.librarySync?.mutationId
              ) {
                await repository.save({
                  ...latest,
                  librarySync: {
                    ...latest.librarySync!,
                    deleted: true,
                    revision: item.revision,
                    mutationId: item.mutationId,
                    syncedMutationId: item.mutationId,
                  },
                });
                emit();
              }
            });
          continue;
        }
        const render = await remote.audio(ctx, item, "render");
        const original = item.originalHash
          ? item.originalHash === item.renderHash &&
            item.originalType === item.renderType
            ? render
            : await remote.audio(ctx, item, "original")
          : undefined;
        await queued(async () => {
          if (!alive(ctx)) return;
          const latest = (await all()).find(
            (r) =>
              r.librarySync?.ownerUserId === ctx.userId &&
              r.librarySync.recordId === item.id,
          );
          if (
            latest &&
            (!existing ||
              latest.librarySync?.mutationId !==
                existing.librarySync?.mutationId ||
              dirty(latest))
          )
            return;
          await repository.save({
            ...item.metadata,
            id: existing?.id || `cloud:${ctx.userId}:${item.id}`,
            audioBlob: render,
            originalBlob: original,
            librarySync: {
              ownerUserId: ctx.userId,
              recordId: item.id,
              revision: item.revision,
              mutationId: item.mutationId,
              syncedMutationId: item.mutationId,
              renderHash: item.renderHash,
              originalHash: item.originalHash,
            },
          });
          emit();
        });
      } catch (error) {
        firstError ??= error;
      }
    }
    if (firstError) throw firstError;
  }
  function sync(): Promise<void> {
    if (inFlight) {
      rerun = true;
      return inFlight;
    }
    const userId = owner();
    if (!userId || (typeof navigator !== "undefined" && !navigator.onLine))
      return Promise.resolve();
    controller = new AbortController();
    const ctx = {
      userId,
      headers: authenticationHeaders(),
      signal: controller.signal,
    };
    state = { busy: true };
    notify("field-library-status");
    inFlight = run(ctx)
      .then(
        () => {
          if (alive(ctx)) state = { busy: false, completedAt: Date.now() };
        },
        (error) => {
          if (alive(ctx))
            state = {
              busy: false,
              error: error instanceof LibrarySyncError ? error.status : 0,
            };
        },
      )
      .finally(() => {
        state = { ...state, busy: false };
        notify("field-library-status");
        inFlight = undefined;
        if (rerun) {
          rerun = false;
          void sync();
        }
      });
    return inFlight;
  }
  const accountChanged = () => {
    controller?.abort();
    state = { busy: false };
    emit();
    notify("field-library-status");
  };
  return {
    save,
    getAll,
    remove,
    clear: repository.clear,
    sync,
    adoptExisting,
    accountChanged,
    status: () => state,
    raw: all,
  };
}
