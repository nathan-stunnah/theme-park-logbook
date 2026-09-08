import type { Category } from './App'
import { COASTERPEDIA_CATALOG } from './coasterpediaCatalog'

export const COASTER_TYPES = [...COASTERPEDIA_CATALOG.coasterTypes]
export type CoasterType = (typeof COASTER_TYPES)[number]

export type AttractionImport = {
  name: string
  category: Category
  sourcePage: string
  coasterType?: string
  trackLengthFeet?: number
  topSpeedMph?: number
  inversions?: number
}

export type ParkImportDefinition = {
  key: string
  name: string
  coasterpediaUrl: string
  attractions: AttractionImport[]
}

export const PARK_IMPORTS: ParkImportDefinition[] = COASTERPEDIA_CATALOG.parks.map(
  (park) => ({
    key: park.key,
    name: park.name,
    coasterpediaUrl: `https://coasterpedia.net/wiki/${encodeURIComponent(park.page.replaceAll(' ', '_'))}`,
    attractions: park.attractions.map((attraction) => ({
      ...attraction,
      category: attraction.category as Category,
    })),
  }),
)
