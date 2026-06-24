// Geofence maths for attendance check-in. Capture-on-action only (no continuous
// tracking): a check-in captures one GPS fix and validates it against a work
// zone's radius.

// Great-circle distance in metres between two lat/lng points (haversine).
export function distanceMetres(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000 // earth radius, metres
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const lat1 = toRad(aLat)
  const lat2 = toRad(bLat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export interface GeoZone { latitude: number | null; longitude: number | null; radius_m: number }

// Is a position inside the zone's radius? Returns null when the zone has no
// coordinates (can't validate). distance is rounded metres.
export function withinGeofence(lat: number, lng: number, zone: GeoZone): { ok: boolean; distance: number } | null {
  if (zone.latitude == null || zone.longitude == null) return null
  const distance = Math.round(distanceMetres(lat, lng, zone.latitude, zone.longitude))
  return { ok: distance <= (zone.radius_m ?? 0), distance }
}
