import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_RIDE_COUNT,
  calculateCoasterAchievements,
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

test('calculateCoasterAchievements multiplies ride specifications by ride count', () => {
  const stats = calculateCoasterAchievements([
    {
      attractionId: 'coaster-a',
      name: 'Coaster A',
      category: 'Rollercoaster',
      times: 2,
      trackLengthMetres: 1500,
      topSpeedMph: 70,
      inversions: 3,
    },
    {
      attractionId: 'coaster-b',
      name: 'Coaster B',
      category: 'Rollercoaster',
      times: 1,
      trackLengthMetres: 1000,
      topSpeedMph: 55,
      inversions: 2,
    },
    {
      attractionId: 'dark-ride',
      name: 'Dark Ride',
      category: 'Dark Ride',
      times: 4,
      trackLengthMetres: 9999,
      inversions: 99,
    },
  ])

  assert.equal(stats.trackKilometres, 4)
  assert.equal(stats.totalInversions, 8)
  assert.equal(stats.totalCoasterRides, 3)
  assert.equal(stats.uniqueCoasters, 2)
  assert.equal(stats.fastestCoaster?.name, 'Coaster A')
  assert.deepEqual(stats.mostRiddenCoaster, { name: 'Coaster A', total: 2 })
})
