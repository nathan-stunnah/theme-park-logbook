import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateSeatCoverage,
  getSeatKey,
} from '../src/rideLayoutUtils.ts'

test('seat coverage counts unique seats and repeat rides', () => {
  const coverage = calculateSeatCoverage(
    [
      { id: 'row-1', seats: 2 },
      { id: 'row-2', seats: 3 },
    ],
    [
      {
        id: 'ride-1',
        attractionId: 'coaster',
        name: 'Coaster',
        category: 'Rollercoaster',
        row: '1',
        seat: '2',
      },
      {
        id: 'ride-2',
        attractionId: 'coaster',
        name: 'Coaster',
        category: 'Rollercoaster',
        row: '1',
        seat: '2',
      },
      {
        id: 'ride-3',
        attractionId: 'coaster',
        name: 'Coaster',
        category: 'Rollercoaster',
        row: '2',
        seat: '3',
      },
    ],
  )

  assert.equal(coverage.totalSeats, 5)
  assert.equal(coverage.uniqueSeatsRidden, 2)
  assert.equal(coverage.coveragePercent, 40)
  assert.equal(coverage.mappedRideLogs, 3)
  assert.equal(coverage.seatCounts.get(getSeatKey(1, 2)), 2)
})

test('seat coverage reports ride logs outside the configured layout', () => {
  const coverage = calculateSeatCoverage(
    [{ id: 'row-1', seats: 2 }],
    [
      {
        id: 'ride-valid',
        attractionId: 'coaster',
        name: 'Coaster',
        category: 'Rollercoaster',
        row: '1',
        seat: '1',
      },
      {
        id: 'ride-invalid-row',
        attractionId: 'coaster',
        name: 'Coaster',
        category: 'Rollercoaster',
        row: '3',
        seat: '1',
      },
      {
        id: 'ride-invalid-seat',
        attractionId: 'coaster',
        name: 'Coaster',
        category: 'Rollercoaster',
        row: '1',
        seat: '4',
      },
      {
        id: 'ride-without-seat',
        attractionId: 'coaster',
        name: 'Coaster',
        category: 'Rollercoaster',
      },
    ],
  )

  assert.equal(coverage.mappedRideLogs, 1)
  assert.equal(coverage.unmappedRideLogs, 2)
  assert.equal(coverage.uniqueSeatsRidden, 1)
})
