export type RecorderState =
  | "idle"
  | "requesting-permission"
  | "recording"
  | "paused"
  | "processing"
  | "ready"
  | "error";
export type EffectId =
  | "original"
  | "echo"
  | "resonator"
  | "tapeStop"
  | "chorus"
  | "flanger"
  | "lofi"
  | "glitch"
  | "reverse"
  | "pitch"
  | "space"
  | "destroy";
export type Visibility = "private" | "group" | "world";
export type Screen =
  | "home"
  | "record"
  | "edit"
  | "fx"
  | "emoji"
  | "title"
  | "style"
  | "location"
  | "visibility"
  | "ready"
  | "library"
  | "daily"
  | "map"
  | "settings"
  | "donate"
  | "randomDonate"
  | "links"
  | "privacy"
  | "microphone"
  | "about"
  | "help";

export interface SoundLocation {
  englishCity?: string;
  nativeCity?: string;
  localizedNames?: Record<string, string>;
  placeId: string;
  city: string;
  country: string;
  countryCode: string;
  region?: string;
  lat: number;
  lng: number;
}

export interface SoundDraft {
  effectChain?: EffectSlot[];
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
  echoDelayMs: number;
  title?: string;
  emojis: string[];
  styleId?: string;
  location?: SoundLocation;
  visibility: Visibility;
  groupId?: string;
  groupName?: string;
  createdAt: number;
  waveform: number[];
  dailyChallenge?: string;
}

export interface SoundRecord {
  schemaVersion?: number;
  effectChain?: EffectSlot[];
  originalBlob?: Blob;
  editState?: Omit<
    SoundDraft,
    "originalBlob" | "processedBlob" | "processedDuration" | "processedWaveform"
  >;
  worldPublication?: {
    ownerUserId?: number;
    state: "pending" | "published" | "failed";
    serverId?: string;
    clientId: string;
  };
  groupPublication?: {
    state: "pending" | "published" | "failed";
    serverId?: string;
    groupId: string;
    groupName?: string;
  };
  id: string;
  title: string;
  emojis: string[];
  styleId: string;
  duration: number;
  createdAt: number;
  favorite: boolean;
  location?: SoundLocation;
  visibility: Visibility;
  groupId?: string;
  groupName?: string;
  audioBlob: Blob;
  waveform: number[];
  effect?: EffectId;
  effectMix?: number;
  echoDelayMs?: number;
  dailyChallenge?: string;
}
export interface EffectSlot {
  effect: EffectId;
  mix: number;
  pitchSemitones: number;
  echoDelayMs: number;
  bypassed?: boolean;
}
