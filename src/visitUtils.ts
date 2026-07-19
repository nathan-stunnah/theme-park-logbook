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
