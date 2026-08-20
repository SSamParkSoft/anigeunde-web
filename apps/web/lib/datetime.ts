const TIMEZONE_SUFFIX = /(?:Z|[+-]\d{2}:\d{2})$/i;

export function parseApiDate(value: string) {
  return new Date(TIMEZONE_SUFFIX.test(value) ? value : `${value}Z`);
}

export function apiTimestamp(value: string | null, fallback: number) {
  return value ? parseApiDate(value).getTime() : fallback;
}
