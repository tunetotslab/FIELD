import links from '../shared/links.json';
export const EXTERNAL_LINKS = links;

const DEFAULT_FIELD_API_URL = 'https://field-api.nikolachenmusic.workers.dev';
export const API_URL = (import.meta.env.VITE_FIELD_API_URL || DEFAULT_FIELD_API_URL).replace(/\/$/, '');
export const COMMUNITY_PUBLISHING_AVAILABLE = Boolean(API_URL) && import.meta.env.VITE_FIELD_WORLD_ENABLED === 'true';
