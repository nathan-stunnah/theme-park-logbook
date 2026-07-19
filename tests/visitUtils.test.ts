import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_RIDE_COUNT,
  aggregateRideLogs,
  calculateCoasterAchievements,
  calculateVisitDraftStats,
  clampRideCount,
  countRideLogs,
  getVisitEntries,
  isActiveVisit,
  readRideLogs,
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

test('legacy visits without a status remain completed visits', () => {
  assert.equal(isActiveVisit({}), false)
  assert.equal(isActiveVisit({ status: 'completed' }), false)
  assert.equal(isActiveVisit({ status: 'active' }), true)
})

test('legacy aggregated entries are read as individual ride logs', () => {
  const visit = {
    id: 'visit-1',
    entries: [
      {
        attractionId: 'coaster',
        name: 'Legacy Coaster',
        category: 'Rollercoaster',
        times: 3,
        inversions: 2,
      },
    ],
  }

  const rideLogs = readRideLogs(visit)

  assert.equal(rideLogs.length, 3)
  assert.deepEqual(
    rideLogs.map((rideLog) => rideLog.id),
    [
      'legacy:visit-1:1:coaster:1',
      'legacy:visit-1:1:coaster:2',
      'legacy:visit-1:1:coaster:3',
    ],
  )
  assert.deepEqual(countRideLogs(rideLogs), { coaster: 3 })
  assert.deepEqual(getVisitEntries(visit), visit.entries)
})

test('individual ride logs remain authoritative when legacy entries also exist', () => {
  const rideLogs = [
    {
      id: 'ride-1',
      attractionId: 'coaster',
      name: 'New Coaster',
      category: 'Rollercoaster',
      riddenAt: '2026-07-19T12:00:00.000Z',
      row: '2',
      seat: '4',
      timeOfDay: 'day' as const,
    },
    {
      id: 'ride-2',
      attractionId: 'coaster',
      name: 'New Coaster',
      category: 'Rollercoaster',
      riddenAt: '2026-07-19T13:00:00.000Z',
      row: '5',
      seat: '1',
      timeOfDay: 'night' as const,
    },
  ]
  const visit = {
    id: 'visit-2',
    entries: [
      {
        attractionId: 'coaster',
        name: 'Old total',
        category: 'Rollercoaster',
        times: 99,
      },
    ],
    rideLogs,
  }

  assert.deepEqual(readRideLogs(visit), rideLogs)
  assert.deepEqual(aggregateRideLogs(rideLogs), [
    {
      attractionId: 'coaster',
      name: 'New Coaster',
      category: 'Rollercoaster',
      times: 2,
    },
  ])
})
