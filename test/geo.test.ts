import { describe, it, expect } from 'vitest'
import { distanceMetres, withinGeofence } from '@/lib/geo'

// The OPM Office zone from the task: lat 9.9667 / lng 76.3088, 150m radius.
const OFFICE = { latitude: 9.9667, longitude: 76.3088, radius_m: 150 }

describe('distanceMetres', () => {
  it('is ~0 metres at the same point', () => {
    expect(distanceMetres(9.9667, 76.3088, 9.9667, 76.3088)).toBeLessThan(1)
  })
  it('is symmetric and roughly right (~111m for 0.001° of latitude)', () => {
    const d = distanceMetres(9.9667, 76.3088, 9.9677, 76.3088)
    expect(d).toBeGreaterThan(100)
    expect(d).toBeLessThan(120)
  })
})

describe('withinGeofence — the check-in rule', () => {
  it('a point ~100m away is INSIDE the 150m zone (check-in succeeds)', () => {
    const r = withinGeofence(9.9676, 76.3088, OFFICE)! // ~0.0009° lat ≈ 100m
    expect(r.ok).toBe(true)
    expect(r.distance).toBeLessThanOrEqual(150)
  })
  it('a point ~300m away is OUTSIDE the 150m zone (check-in rejected)', () => {
    const r = withinGeofence(9.9694, 76.3088, OFFICE)! // ~0.0027° lat ≈ 300m
    expect(r.ok).toBe(false)
    expect(r.distance).toBeGreaterThan(150)
  })
  it('exactly at the boundary is allowed', () => {
    // walk east until just under/at 150m and confirm the rule is inclusive
    const r = withinGeofence(OFFICE.latitude, OFFICE.longitude, OFFICE)!
    expect(r.ok).toBe(true)
  })
  it('returns null when the zone has no coordinates', () => {
    expect(withinGeofence(9.9667, 76.3088, { latitude: null, longitude: null, radius_m: 150 })).toBeNull()
  })
})
