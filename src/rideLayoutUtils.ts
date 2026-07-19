import type { RideLog } from './visitUtils'

export type VehicleRow = {
  id: string
  seats: number
}

export type VehicleLayout = {
  rows: VehicleRow[]
}

export type SeatCoverage = {
  totalSeats: number
  uniqueSeatsRidden: number
  coveragePercent: number
  mappedRideLogs: number
  unmappedRideLogs: number
  seatCounts: Map<string, number>
}

export function getSeatKey(row: number, seat: number) {
  return `${row}:${seat}`
}

export function calculateSeatCoverage(
  rows: VehicleRow[],
  rideLogs: RideLog[],
): SeatCoverage {
  const totalSeats = rows.reduce(
    (total, row) => total + Math.max(0, Math.trunc(row.seats)),
    0,
  )
  const seatCounts = new Map<string, number>()
  let mappedRideLogs = 0
  let unmappedRideLogs = 0

  rideLogs.forEach((rideLog) => {
    if (!rideLog.row || !rideLog.seat) return

    const rowNumber = Number(rideLog.row)
    const seatNumber = Number(rideLog.seat)
    const targetRow = rows[rowNumber - 1]
    const validSeat =
      Number.isInteger(rowNumber) &&
      Number.isInteger(seatNumber) &&
      rowNumber > 0 &&
      seatNumber > 0 &&
      targetRow &&
      seatNumber <= targetRow.seats

    if (!validSeat) {
      unmappedRideLogs += 1
      return
    }

    const seatKey = getSeatKey(rowNumber, seatNumber)
    seatCounts.set(seatKey, (seatCounts.get(seatKey) ?? 0) + 1)
    mappedRideLogs += 1
  })

  return {
    totalSeats,
    uniqueSeatsRidden: seatCounts.size,
    coveragePercent:
      totalSeats === 0 ? 0 : (seatCounts.size / totalSeats) * 100,
    mappedRideLogs,
    unmappedRideLogs,
    seatCounts,
  }
}
