export const MIN_RIDE_COUNT = 0
export const MAX_RIDE_COUNT = 999

type DraftAttraction = {
  id: string
  category: string
}

export type VisitDraftStats = {
  totalExperiences: number
  uniqueAttractions: number
  rideExperiences: number
  scareExperiences: number
}

export type CoasterStatsEntry = {
  attractionId: string
  name: string
  category: string
  times: number
  trackLengthMetres?: number
  topSpeedMph?: number
  inversions?: number
}

export type RideLog = Omit<CoasterStatsEntry, 'times'> & {
  id: string
  riddenAt?: string
  row?: string
  seat?: string
  timeOfDay?: 'day' | 'night'
}

export type VisitRideData = {
  id: string
  entries?: CoasterStatsEntry[]
  rideLogs?: RideLog[]
}

export type CoasterAchievements = {
  trackKilometres: number
  trackMiles: number
  totalInversions: number
  totalCoasterRides: number
  uniqueCoasters: number
  fastestCoaster: CoasterStatsEntry | null
  mostRiddenCoaster?: {
    name: string
    total: number
  }
}

export function isActiveVisit(visit: { status?: string }) {
  return visit.status === 'active'
}

export function readRideLogs(visit: VisitRideData): RideLog[] {
  if (Array.isArray(visit.rideLogs)) return visit.rideLogs

  return (visit.entries ?? []).flatMap((entry, entryIndex) =>
    Array.from({ length: clampRideCount(entry.times) }, (_, index) => ({
      id: `legacy:${visit.id}:${entryIndex + 1}:${entry.attractionId}:${index + 1}`,
      attractionId: entry.attractionId,
      name: entry.name,
      category: entry.category,
      trackLengthMetres: entry.trackLengthMetres,
      topSpeedMph: entry.topSpeedMph,
      inversions: entry.inversions,
    })),
  )
}

export function aggregateRideLogs(rideLogs: RideLog[]): CoasterStatsEntry[] {
  return Array.from(
    rideLogs.reduce((entries, rideLog) => {
      const existing = entries.get(rideLog.attractionId)

      entries.set(rideLog.attractionId, {
        attractionId: rideLog.attractionId,
        name: rideLog.name,
        category: rideLog.category,
        times: (existing?.times ?? 0) + 1,
        ...(rideLog.trackLengthMetres === undefined
          ? {}
          : { trackLengthMetres: rideLog.trackLengthMetres }),
        ...(rideLog.topSpeedMph === undefined
          ? {}
          : { topSpeedMph: rideLog.topSpeedMph }),
        ...(rideLog.inversions === undefined
          ? {}
          : { inversions: rideLog.inversions }),
      })

      return entries
    }, new Map<string, CoasterStatsEntry>()),
  ).map(([, entry]) => entry)
}

export function getVisitEntries(visit: VisitRideData) {
  return aggregateRideLogs(readRideLogs(visit))
}

export function countRideLogs(rideLogs: RideLog[]) {
  return rideLogs.reduce<Record<string, number>>((counts, rideLog) => {
    counts[rideLog.attractionId] = (counts[rideLog.attractionId] ?? 0) + 1
    return counts
  }, {})
}

export function clampRideCount(times: number) {
  if (!Number.isFinite(times)) return MIN_RIDE_COUNT

  return Math.min(
    MAX_RIDE_COUNT,
    Math.max(MIN_RIDE_COUNT, Math.trunc(times)),
  )
}

export function calculateVisitDraftStats(
  attractions: DraftAttraction[],
  rideCounts: Record<string, number>,
): VisitDraftStats {
  return attractions.reduce<VisitDraftStats>(
    (stats, attraction) => {
      const times = clampRideCount(rideCounts[attraction.id] ?? 0)
      if (times === 0) return stats

      stats.totalExperiences += times
      stats.uniqueAttractions += 1

      if (
        attraction.category === 'Scare Maze' ||
        attraction.category === 'Scare Zone'
      ) {
        stats.scareExperiences += times
      } else {
        stats.rideExperiences += times
      }

      return stats
    },
    {
      totalExperiences: 0,
      uniqueAttractions: 0,
      rideExperiences: 0,
      scareExperiences: 0,
    },
  )
}

export function calculateCoasterAchievements(
  entries: CoasterStatsEntry[],
): CoasterAchievements {
  const coasterEntries = entries.filter(
    (entry) => entry.category === 'Rollercoaster' && entry.times > 0,
  )
  const totalTrackMetres = coasterEntries.reduce(
    (total, entry) => total + (entry.trackLengthMetres ?? 0) * entry.times,
    0,
  )
  const totalInversions = coasterEntries.reduce(
    (total, entry) => total + (entry.inversions ?? 0) * entry.times,
    0,
  )
  const fastestCoaster = coasterEntries.reduce<CoasterStatsEntry | null>(
    (fastest, entry) =>
      (entry.topSpeedMph ?? 0) > (fastest?.topSpeedMph ?? 0) ? entry : fastest,
    null,
  )
  const coasterRideTotals = coasterEntries.reduce(
    (totals, entry) => {
      const existing = totals.get(entry.attractionId)
      totals.set(entry.attractionId, {
        name: entry.name,
        total: (existing?.total ?? 0) + entry.times,
      })
      return totals
    },
    new Map<string, { name: string; total: number }>(),
  )
  const mostRiddenCoaster = Array.from(coasterRideTotals.values()).sort(
    (first, second) => second.total - first.total,
  )[0]

  return {
    trackKilometres: totalTrackMetres / 1000,
    trackMiles: totalTrackMetres / 1609.344,
    totalInversions,
    totalCoasterRides: coasterEntries.reduce(
      (total, entry) => total + entry.times,
      0,
    ),
    uniqueCoasters: coasterRideTotals.size,
    fastestCoaster,
    mostRiddenCoaster,
  }
}
