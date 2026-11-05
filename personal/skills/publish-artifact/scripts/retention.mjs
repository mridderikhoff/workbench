// Shared by the publisher and site builder; durations use fixed-length days.
export const MAX_VERSIONS = 10;
export const DEFAULT_RETENTION_DAYS = 30;
export const VERSION_ID = /^\d{8}T\d{6}Z(?:-\d+)?$/;
export const DAY_MS = 86400_000;

export function parseVersionDate(id) {
  const m = id.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : NaN;
}

export function parseRetention(value) {
  if (value === 'unlimited') return null;
  const match = String(value).match(/^(\d+)(d|w|mo|y)?$/);
  const days = match ? Number(match[1]) * ({ d: 1, w: 7, mo: 30, y: 365 }[match[2] || 'd']) : NaN;
  if (!Number.isSafeInteger(days) || days < 1 || days > 365000) {
    throw new Error('Use a retention of 1–365000 days (e.g. 30d, 8w, 3mo, 1y), or unlimited.');
  }
  return days;
}

export function retentionDays(meta = {}) {
  const days = meta.retentionDays;
  if (days === undefined) return DEFAULT_RETENTION_DAYS;
  if (days === null) return null;
  if (!Number.isSafeInteger(days) || days < 1 || days > 365000) throw new Error('Invalid artifact retentionDays; expected 1–365000 or null for unlimited.');
  return days;
}

// Always retain the newest version, including when the artifact itself is old.
export function expiredVersions(ids, days, now = Date.now(), keep = 1) {
  return [...new Set(ids)].filter(id => VERSION_ID.test(id)).sort().reverse()
    .filter((id, index) => index >= MAX_VERSIONS || (index >= keep && days !== null && parseVersionDate(id) <= now - days * DAY_MS));
}

export function artifactTags(meta = {}) {
  return [...new Set([...(Array.isArray(meta.teams) ? meta.teams : []), ...(Array.isArray(meta.tags) ? meta.tags : [])])]
    .filter(tag => typeof tag === 'string' && /^[a-z0-9-]+$/.test(tag)).sort();
}

// Missing lifetime metadata belongs to pre-v6 artifacts and remains durable.
export function artifactExpired(meta = {}, now = Date.now()) {
  if (meta.expiresAt === undefined || meta.expiresAt === null) return false;
  const expiry = typeof meta.expiresAt === 'string' ? Date.parse(meta.expiresAt) : NaN;
  if (!Number.isFinite(expiry)) throw new Error('Invalid artifact expiresAt; expected an ISO date or null.');
  return expiry <= now;
}

export function lifetimeMetadata(days, now = Date.now()) {
  return { lifetimeDays: days, expiresAt: days === null ? null : new Date(now + days * DAY_MS).toISOString() };
}
