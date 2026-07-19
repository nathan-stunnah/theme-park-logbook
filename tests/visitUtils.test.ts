import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_RIDE_COUNT,
  calculateVisitDraftStats,
  clampRideCount,
} from '../src/visitUtils.ts'

test('clampRideCount keeps the stepper inside its valid range', () => {
  assert.equal(clampRideCount(-1), 0)
  assert.equal(clampRideCount(0), 0)
  assert.equal(clampRideCount(3.8), 3)
  assert.equal(clampRideCount(MAX_RIDE_COUNT + 1), MAX_RIDE_COUNT)
  assert.equal(clampRideCount(Number.NaN), 0)
})

test('calculateVisitDraftStats updates totals from the current counts', () => {
  const attractions = [
    { id: 'coaster', category: 'Rollercoaster' },
    { id: 'dark-ride', category: 'Dark Ride' },
    { id: 'maze', category: 'Scare Maze' },
  ]

  assert.deepEqual(
    calculateVisitDraftStats(attractions, {
      coaster: 2,
      'dark-ride': 1,
      maze: 3,
      removedAttraction: 20,
    }),
    {
      totalExperiences: 6,
      uniqueAttractions: 3,
      rideExperiences: 3,
      scareExperiences: 3,
    },
  )
})

test('zero-count attractions are not included as unique experiences', () => {
  assert.deepEqual(
    calculateVisitDraftStats(
      [{ id: 'coaster', category: 'Rollercoaster' }],
      { coaster: 0 },
    ),
    {
      totalExperiences: 0,
      uniqueAttractions: 0,
      rideExperiences: 0,
      scareExperiences: 0,
    },
  )
})
