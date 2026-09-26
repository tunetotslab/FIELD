export type RecorderState = 'idle' | 'requesting-permission' | 'recording' | 'paused' | 'processing' | 'ready' | 'error';
export type EffectId = 'clean' | 'warm' | 'tape' | 'lofi' | 'glitch' | 'reverse' | 'pitch' | 'space' | 'destroy';
export type Visibility = 'private' | 'group' | 'world';
export type Screen = 'home' | 'record' | 'edit' | 'fx' | 'emoji' | 'title' | 'style' | 'location' | 'visibility' | 'ready' | 'library' | 'daily' | 'map' | 'settings' | 'links';

export interface SoundDraft {
  id: string;
  originalBlob: Blob;
  processedBlob?: Blob;
  processedDuration?: number;
  processedWaveform?: number[];
  duration: number;
  trimStart: number;
  trimEnd: number;
  fadeIn: boolean;
  fadeOut: boolean;
  loop: boolean;
  effect: EffectId;
  effectMix: number;
  pitchSemitones: number;
  title?: string;
  emojis: string[];
  styleId?: string;
  location?: { country?: string; city?: string };
  visibility: Visibility;
  createdAt: number;
  waveform: number[];
}

export interface SoundRecord {
  id: string;
  title: string;
  emojis: string[];
  styleId: string;
  duration: number;
  createdAt: number;
  favorite: boolean;
  location?: { country?: string; city?: string };
  visibility: Visibility;
  audioBlob: Blob;
  waveform: number[];
}
