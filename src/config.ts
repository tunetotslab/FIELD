export const EXTERNAL_LINKS = {
  TUNE_TOTS_INSTAGRAM: "https://www.instagram.com/tunetots_lab",
  TUNE_TOTS_WEBSITE: "https://tunetotslab.github.io/",
  TUNE_TOTS_TELEGRAM: "https://t.me/tunetots",
  NIKOLA_INSTAGRAM: "https://www.instagram.com/nikolachenmusic",
  NIKOLA_TELEGRAM: "https://t.me/nikolachenmusic",
  NIKOLA_PORTFOLIO: "http://nikolachen.tilda.ws",
  SUPPORT_EMAIL: "mailto:tunetotslab@gmail.com",
} as const;

export const API_URL = (import.meta.env.VITE_FIELD_API_URL || '').replace(/\/$/, '');
export const COMMUNITY_PUBLISHING_AVAILABLE = Boolean(API_URL) && import.meta.env.VITE_FIELD_WORLD_ENABLED === 'true';
