/**
 * Formats a duration in seconds as H:MM:SS (omits leading zero on hours if < 1h).
 * e.g. 83 → "1:23", 3725 → "1:02:05"
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

/**
 * Formats a speed in m/s as a pace string "M:SS /km".
 * Returns "–:– /km" for zero or invalid speed.
 */
export function formatPace(speedMps: number): string {
  if (!speedMps || speedMps <= 0) return '–:– /km'
  const paceSecPerKm = 1000 / speedMps
  const m = Math.floor(paceSecPerKm / 60)
  const s = Math.round(paceSecPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')} /km`
}
