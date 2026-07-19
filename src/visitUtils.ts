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
