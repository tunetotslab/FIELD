import type { SoundDraft } from "../types";

export const changesAudio = (patch: Partial<SoundDraft>) =>
  [
    "effect",
    "effectChain",
    "effectMix",
    "pitchSemitones",
    "echoDelayMs",
    "trimStart",
    "trimEnd",
    "fadeIn",
    "fadeOut",
  ].some((key) => key in patch);

/** Metadata edits keep the saved render, including legacy records with no original. */
export function patchDraft(
  current: SoundDraft,
  patch: Partial<SoundDraft>,
): SoundDraft {
  return {
    ...current,
    ...(changesAudio(patch)
      ? {
          processedBlob: undefined,
          processedDuration: undefined,
          processedWaveform: undefined,
        }
      : {}),
    ...patch,
  };
}
