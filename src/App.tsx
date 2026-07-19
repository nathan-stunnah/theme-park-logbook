import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import './App.css'
import { PARK_IMPORTS } from './parkImports'
import { isSupabaseConfigured, supabase } from './supabase'
import {
  MAX_RIDE_COUNT,
  calculateVisitDraftStats,
  clampRideCount,
} from './visitUtils'

export type Category =
  | 'Rollercoaster'
  | 'Flat Ride'
  | 'Dark Ride'
  | 'Scare Maze'
  | 'Scare Zone'
  | 'Other'

type Attraction = {
  id: string
  name: string
  category: Category
  trackLengthMetres?: number
  topSpeedMph?: number
  inversions?: number
  source?: 'themeparks-wiki'
  sourceId?: string
  importedAt?: string
}

type Park = {
  id: string
  name: string
  attractions: Attraction[]
}

type VisitEntry = {
  attractionId: string
  name: string
  category: Category
  times: number
  trackLengthMetres?: number
  topSpeedMph?: number
  inversions?: number
}

type Visit = {
  id: string
  parkId: string
  parkName: string
  date: string
  entries: VisitEntry[]
}

type Panel = 'visit' | 'parks' | null
type AuthMode = 'sign-in' | 'sign-up'
type SyncStatus = 'local' | 'loading' | 'saving' | 'synced' | 'error'

type CloudData = {
  version: number
  parks: Park[]
  visits: Visit[]
}

type ImportCandidate = {
  sourceId: string
  name: string
  category: Category
  trackLengthMetres?: number
  topSpeedMph?: number
  inversions?: number
}

const categories: Category[] = [
  'Rollercoaster',
  'Flat Ride',
  'Dark Ride',
  'Scare Maze',
  'Scare Zone',
  'Other',
]

const categoryIcons: Record<Category, string> = {
  Rollercoaster: '🎢',
  'Flat Ride': '🎠',
  'Dark Ride': '👻',
  'Scare Maze': '🎃',
  'Scare Zone': '🧟',
  Other: '🎪',
}

const currentYear = String(new Date().getFullYear())

function readSavedData<T>(key: string): T[] {
  const savedData = localStorage.getItem(key)

  if (!savedData) return []

  try {
    return JSON.parse(savedData) as T[]
  } catch {
    return []
  }
}

function sortAttractions(attractions: Attraction[]) {
  return [...attractions].sort((first, second) =>
    first.name.localeCompare(second.name, 'en-GB', { sensitivity: 'base' }),
  )
}

function totalTimes(entries: VisitEntry[], selectedCategories: Category[]) {
  return entries
    .filter((entry) => selectedCategories.includes(entry.category))
    .reduce((total, entry) => total + entry.times, 0)
}

function uniqueAttractions(
  entries: VisitEntry[],
  selectedCategories: Category[],
) {
  return new Set(
    entries
      .filter((entry) => selectedCategories.includes(entry.category))
      .map((entry) => entry.attractionId),
  ).size
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`))
}

function formatSyncTime(date: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

type CoasterAchievements = {
  trackKilometres: number
  trackMiles: number
  totalInversions: number
  fastestCoaster: VisitEntry | null
  mostRiddenCoaster?: {
    name: string
    total: number
  }
}

function calculateCoasterAchievements(entries: VisitEntry[]): CoasterAchievements {
  const coasterEntries = entries.filter(
    (entry) => entry.category === 'Rollercoaster',
  )
  const totalTrackMetres = coasterEntries.reduce(
    (total, entry) => total + (entry.trackLengthMetres ?? 0) * entry.times,
    0,
  )
  const totalInversions = coasterEntries.reduce(
    (total, entry) => total + (entry.inversions ?? 0) * entry.times,
    0,
  )
  const fastestCoaster = coasterEntries.reduce<VisitEntry | null>(
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
    fastestCoaster,
    mostRiddenCoaster,
  }
}

function AchievementCards({ stats }: { stats: CoasterAchievements }) {
  return (
    <div className="fun-stats-grid">
      <article className="fun-stat purple">
        <span>🛤️</span>
        <strong>{stats.trackKilometres.toFixed(1)} km</strong>
        <p>Track ridden</p>
        <small>{stats.trackMiles.toFixed(1)} miles</small>
      </article>
      <article className="fun-stat red">
        <span>⚡️</span>
        <strong>{stats.fastestCoaster?.topSpeedMph ?? 0} mph</strong>
        <p>Fastest coaster</p>
        <small>{stats.fastestCoaster?.name ?? 'No speed recorded yet'}</small>
      </article>
      <article className="fun-stat blue">
        <span>🌀</span>
        <strong>{stats.totalInversions}</strong>
        <p>Inversions experienced</p>
        <small>Across every logged coaster ride</small>
      </article>
      <article className="fun-stat green">
        <span>🏆</span>
        <strong>{stats.mostRiddenCoaster?.total ?? 0}</strong>
        <p>Most-ridden coaster</p>
        <small>{stats.mostRiddenCoaster?.name ?? 'No coasters logged yet'}</small>
      </article>
    </div>
  )
}

function RideBreakdownCards({
  visitCount,
  entries,
}: {
  visitCount: number
  entries: VisitEntry[]
}) {
  return (
    <div className="year-stats-grid">
      <article className="mini-stat">
        <span>🎟️</span>
        <strong>{visitCount}</strong>
        <p>Park visits</p>
      </article>
      {categories.map((category) => (
        <article className="mini-stat" key={category}>
          <span>{categoryIcons[category]}</span>
          <strong>{totalTimes(entries, [category])}</strong>
          <p>{category}</p>
        </article>
      ))}
    </div>
  )
}

function App() {
  const [panel, setPanel] = useState<Panel>(null)
  const [selectedYear, setSelectedYear] = useState(currentYear)

  const [parks, setParks] = useState<Park[]>(() =>
    readSavedData<Park>('theme-park-parks-v2'),
  )
  const [visits, setVisits] = useState<Visit[]>(() =>
    readSavedData<Visit>('theme-park-visits-v2'),
  )
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [authMode, setAuthMode] = useState<AuthMode>('sign-in')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [cloudLoaded, setCloudLoaded] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local')
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)

  const [newParkName, setNewParkName] = useState('')
  const [attractionParkId, setAttractionParkId] = useState('')
  const [newAttractionName, setNewAttractionName] = useState('')
  const [newAttractionCategory, setNewAttractionCategory] =
    useState<Category>('Rollercoaster')
  const [trackLengthMetres, setTrackLengthMetres] = useState('')
  const [topSpeedMph, setTopSpeedMph] = useState('')
  const [inversions, setInversions] = useState('')
  const [editingAttraction, setEditingAttraction] = useState<{
    parkId: string
    attractionId: string
  } | null>(null)
  const [importParkKey, setImportParkKey] = useState(PARK_IMPORTS[0].key)
  const [importCandidates, setImportCandidates] = useState<ImportCandidate[]>([])
  const [selectedImports, setSelectedImports] = useState<Record<string, boolean>>({})
  const [importLoading, setImportLoading] = useState(false)
  const [importMessage, setImportMessage] = useState('')

  const [visitParkId, setVisitParkId] = useState('')
  const [visitDate, setVisitDate] = useState('')
  const [rideCounts, setRideCounts] = useState<Record<string, number>>({})
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null)

  useEffect(() => {
    localStorage.setItem('theme-park-parks-v2', JSON.stringify(parks))
  }, [parks])

  useEffect(() => {
    localStorage.setItem('theme-park-visits-v2', JSON.stringify(visits))
  }, [visits])

  useEffect(() => {
    if (!supabase) return

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSyncStatus(data.session ? 'loading' : 'local')
      setAuthReady(true)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setCloudLoaded(false)
      setSyncStatus(nextSession ? 'loading' : 'local')
      if (!nextSession) setLastSyncedAt(null)
      setAuthReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadCloudData = useCallback(async (userId: string) => {
    if (!supabase) return

    setSyncStatus('loading')

    const { data: row, error } = await supabase
      .from('user_data')
      .select('data, updated_at')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      setSyncStatus('error')
      setAuthMessage(`Sync error: ${error.message}`)
      return
    }

    const cloudData = row?.data as CloudData | undefined

    if (cloudData) {
      setParks(Array.isArray(cloudData.parks) ? cloudData.parks : [])
      setVisits(Array.isArray(cloudData.visits) ? cloudData.visits : [])
      if (row?.updated_at) setLastSyncedAt(row.updated_at as string)
    }

    setCloudLoaded(true)
    setSyncStatus(cloudData ? 'synced' : 'saving')
  }, [])

  useEffect(() => {
    if (!session) return

    const timer = window.setTimeout(() => {
      void loadCloudData(session.user.id)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadCloudData, session])

  useEffect(() => {
    const client = supabase
    if (!client || !session || !cloudLoaded) return

    const timer = window.setTimeout(() => {
      setSyncStatus('saving')
      void client
        .from('user_data')
        .upsert(
          {
            user_id: session.user.id,
            data: {
              version: 1,
              parks,
              visits,
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        )
        .then(({ error }) => {
          if (error) {
            setSyncStatus('error')
            setAuthMessage(`Sync error: ${error.message}`)
          } else {
            setSyncStatus('synced')
            setLastSyncedAt(new Date().toISOString())
          }
        })
    }, 700)

    return () => window.clearTimeout(timer)
  }, [cloudLoaded, parks, session, visits])

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return

    setAuthBusy(true)
    setAuthMessage('')

    const credentials = {
      email: authEmail.trim(),
      password: authPassword,
    }

    const { data, error } =
      authMode === 'sign-up'
        ? await supabase.auth.signUp({
            ...credentials,
            options: { emailRedirectTo: window.location.origin },
          })
        : await supabase.auth.signInWithPassword(credentials)

    if (error) {
      setAuthMessage(error.message)
    } else if (authMode === 'sign-up' && !data.session) {
      setAuthMessage('Check your email to confirm the account, then sign in here.')
      setAuthMode('sign-in')
    } else {
      setAuthMessage('Signed in. Loading your private cloud data…')
      setAuthPassword('')
    }

    setAuthBusy(false)
  }

  async function handleSignOut() {
    if (!supabase) return
    await supabase.auth.signOut()
    setAuthMessage('Signed out. This device will continue using its local copy.')
  }

  async function handleSyncNow() {
    if (!session) return
    await loadCloudData(session.user.id)
  }

  const selectedPark = parks.find((park) => park.id === visitParkId)
  const visitDraftStats = useMemo(
    () =>
      calculateVisitDraftStats(selectedPark?.attractions ?? [], rideCounts),
    [rideCounts, selectedPark],
  )

  const attractionLookup = useMemo(
    () =>
      new Map(
        parks.flatMap((park) =>
          park.attractions.map((attraction) => [attraction.id, attraction] as const),
        ),
      ),
    [parks],
  )

  function enrichEntries(selectedVisits: Visit[]) {
    return selectedVisits.flatMap((visit) =>
      visit.entries.map((entry) => {
        const currentAttraction = attractionLookup.get(entry.attractionId)

        if (!currentAttraction) return entry

        return {
          ...entry,
          trackLengthMetres: currentAttraction.trackLengthMetres,
          topSpeedMph: currentAttraction.topSpeedMph,
          inversions: currentAttraction.inversions,
        }
      }),
    )
  }

  const allEntries = enrichEntries(visits)

  const availableYears = useMemo(
    () =>
      Array.from(
        new Set([currentYear, ...visits.map((visit) => visit.date.slice(0, 4))]),
      ).sort((first, second) => Number(second) - Number(first)),
    [visits],
  )

  const yearlyVisits = visits.filter((visit) =>
    visit.date.startsWith(selectedYear),
  )
  const yearlyEntries = enrichEntries(yearlyVisits)

  function handleAddPark(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const name = newParkName.trim()
    if (!name) return

    const newPark: Park = {
      id: crypto.randomUUID(),
      name,
      attractions: [],
    }

    setParks((currentParks) => [...currentParks, newPark])
    setAttractionParkId(newPark.id)
    setVisitParkId(newPark.id)
    setNewParkName('')
  }

  function handleAddAttraction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const name = newAttractionName.trim()
    if (!attractionParkId || !name) return
    const targetParkId = editingAttraction?.parkId ?? attractionParkId
    const existingAttraction = editingAttraction
      ? parks
          .find((park) => park.id === editingAttraction.parkId)
          ?.attractions.find(
            (attraction) => attraction.id === editingAttraction.attractionId,
          )
      : undefined

    const attractionDetails: Attraction = {
      ...existingAttraction,
      id: editingAttraction?.attractionId ?? crypto.randomUUID(),
      name,
      category: newAttractionCategory,
      trackLengthMetres:
        newAttractionCategory === 'Rollercoaster' && trackLengthMetres
          ? Number(trackLengthMetres)
          : undefined,
      topSpeedMph:
        newAttractionCategory === 'Rollercoaster' && topSpeedMph
          ? Number(topSpeedMph)
          : undefined,
      inversions:
        newAttractionCategory === 'Rollercoaster' && inversions
          ? Number(inversions)
          : undefined,
    }

    setParks((currentParks) =>
      currentParks.map((park) => {
        if (park.id !== targetParkId) return park

        if (editingAttraction) {
          return {
            ...park,
            attractions: park.attractions.map((attraction) =>
              attraction.id === editingAttraction.attractionId
                ? attractionDetails
                : attraction,
            ),
          }
        }

        return {
          ...park,
          attractions: [...park.attractions, attractionDetails],
        }
      }),
    )

    resetAttractionForm()
  }

  async function loadImportPreview() {
    const definition = PARK_IMPORTS.find((park) => park.key === importParkKey)
    if (!definition) return

    setImportLoading(true)
    setImportMessage('')

    try {
      const response = await fetch(
        `https://api.themeparks.wiki/v1/entity/${definition.entityId}/children`,
      )

      if (!response.ok) {
        throw new Error(`The attraction service returned ${response.status}.`)
      }

      const result = (await response.json()) as {
        children?: Array<{
          id: string
          name: string
          entityType: string
        }>
      }

      const candidates = (result.children ?? [])
        .filter((child) => child.entityType === 'ATTRACTION')
        .map((child): ImportCandidate => {
          const override = definition.overrides[child.name]

          return {
            sourceId: child.id,
            name: child.name,
            category: override?.category ?? 'Other',
            trackLengthMetres: override?.trackLengthMetres,
            topSpeedMph: override?.topSpeedMph,
            inversions: override?.inversions,
          }
        })
        .sort((first, second) =>
          first.name.localeCompare(second.name, 'en-GB', { sensitivity: 'base' }),
        )

      setImportCandidates(candidates)
      setSelectedImports(
        Object.fromEntries(candidates.map((candidate) => [candidate.sourceId, true])),
      )
      setImportMessage(
        `${candidates.length} current attractions found. Review the list before importing.`,
      )
    } catch (error) {
      setImportCandidates([])
      setSelectedImports({})
      setImportMessage(
        error instanceof Error
          ? error.message
          : 'The attraction list could not be loaded.',
      )
    } finally {
      setImportLoading(false)
    }
  }

  function importSelectedAttractions() {
    const definition = PARK_IMPORTS.find((park) => park.key === importParkKey)
    if (!definition) return

    const chosen = importCandidates.filter(
      (candidate) => selectedImports[candidate.sourceId],
    )
    const importedAt = new Date().toISOString()
    const existingPark = parks.find(
      (park) => park.name.toLowerCase() === definition.name.toLowerCase(),
    )
    const existingAttractions = existingPark?.attractions ?? []
    const existingSourceIds = new Set(
      existingAttractions.map((attraction) => attraction.sourceId).filter(Boolean),
    )
    const existingNames = new Set(
      existingAttractions.map((attraction) => attraction.name.toLowerCase()),
    )
    const additions: Attraction[] = chosen
      .filter(
        (candidate) =>
          !existingSourceIds.has(candidate.sourceId) &&
          !existingNames.has(candidate.name.toLowerCase()),
      )
      .map((candidate) => ({
        id: candidate.sourceId,
        name: candidate.name,
        category: candidate.category,
        trackLengthMetres: candidate.trackLengthMetres,
        topSpeedMph: candidate.topSpeedMph,
        inversions: candidate.inversions,
        source: 'themeparks-wiki',
        sourceId: candidate.sourceId,
        importedAt,
      }))

    if (existingPark) {
      setParks((currentParks) =>
        currentParks.map((park) =>
          park.id === existingPark.id
            ? {
                ...park,
                attractions: [...park.attractions, ...additions],
              }
            : park,
        ),
      )
    } else {
      const newPark: Park = {
        id: crypto.randomUUID(),
        name: definition.name,
        attractions: additions,
      }

      setParks((currentParks) => [...currentParks, newPark])
      setAttractionParkId(newPark.id)
      setVisitParkId(newPark.id)
    }

    setImportMessage(
      additions.length > 0
        ? `${additions.length} attractions imported. You can edit or remove any of them below.`
        : 'Nothing new was imported; those attractions are already in your library.',
    )
  }

  function resetAttractionForm() {
    setNewAttractionName('')
    setNewAttractionCategory('Rollercoaster')
    setTrackLengthMetres('')
    setTopSpeedMph('')
    setInversions('')
    setEditingAttraction(null)
  }

  function startEditingAttraction(park: Park, attraction: Attraction) {
    setAttractionParkId(park.id)
    setNewAttractionName(attraction.name)
    setNewAttractionCategory(attraction.category)
    setTrackLengthMetres(String(attraction.trackLengthMetres ?? ''))
    setTopSpeedMph(String(attraction.topSpeedMph ?? ''))
    setInversions(String(attraction.inversions ?? ''))
    setEditingAttraction({ parkId: park.id, attractionId: attraction.id })
  }

  function handleSaveVisit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedPark || !visitDate) return

    const selectedEntries: VisitEntry[] = sortAttractions(selectedPark.attractions)
      .filter((attraction) => (rideCounts[attraction.id] ?? 0) > 0)
      .map((attraction) => ({
        attractionId: attraction.id,
        name: attraction.name,
        category: attraction.category,
        times: rideCounts[attraction.id],
        trackLengthMetres: attraction.trackLengthMetres,
        topSpeedMph: attraction.topSpeedMph,
        inversions: attraction.inversions,
      }))
    const originalVisit = editingVisitId
      ? visits.find((visit) => visit.id === editingVisitId)
      : undefined
    const currentAttractionIds = new Set(
      selectedPark.attractions.map((attraction) => attraction.id),
    )
    const historicalEntries = (originalVisit?.entries ?? []).filter(
      (entry) => !currentAttractionIds.has(entry.attractionId),
    )
    const entries = [...selectedEntries, ...historicalEntries].sort((first, second) =>
      first.name.localeCompare(second.name, 'en-GB', { sensitivity: 'base' }),
    )

    const newVisit: Visit = {
      id: editingVisitId ?? crypto.randomUUID(),
      parkId: selectedPark.id,
      parkName: selectedPark.name,
      date: visitDate,
      entries,
    }

    setVisits((currentVisits) =>
      editingVisitId
        ? currentVisits.map((visit) =>
            visit.id === editingVisitId ? newVisit : visit,
          )
        : [newVisit, ...currentVisits],
    )
    closeVisitPanel()
  }

  function openNewVisit() {
    setEditingVisitId(null)
    setVisitDate('')
    setRideCounts({})
    if (!visitParkId && parks[0]) setVisitParkId(parks[0].id)
    setPanel('visit')
  }

  function startEditingVisit(visit: Visit) {
    const parkStillExists = parks.some((park) => park.id === visit.parkId)

    if (!parkStillExists) {
      window.alert(
        'This visit cannot be edited until its park exists in your park library again.',
      )
      return
    }

    setEditingVisitId(visit.id)
    setVisitParkId(visit.parkId)
    setVisitDate(visit.date)
    setRideCounts(
      Object.fromEntries(
        visit.entries.map((entry) => [entry.attractionId, entry.times]),
      ),
    )
    setPanel('visit')
  }

  function closeVisitPanel() {
    setEditingVisitId(null)
    setVisitDate('')
    setRideCounts({})
    setPanel(null)
  }

  function setAttractionSelected(attractionId: string, selected: boolean) {
    setRideCounts((currentCounts) => ({
      ...currentCounts,
      [attractionId]: selected ? Math.max(currentCounts[attractionId] ?? 1, 1) : 0,
    }))
  }

  function setAttractionCount(attractionId: string, times: number) {
    setRideCounts((currentCounts) => ({
      ...currentCounts,
      [attractionId]: clampRideCount(times),
    }))
  }

  function deleteVisit(id: string) {
    const visit = visits.find((item) => item.id === id)
    if (!visit) return

    const confirmed = window.confirm(
      `Delete the ${formatDate(visit.date)} visit to ${visit.parkName}? This cannot be undone.`,
    )
    if (!confirmed) return

    setVisits((currentVisits) =>
      currentVisits.filter((visit) => visit.id !== id),
    )
  }

  function deleteAttraction(parkId: string, attractionId: string) {
    const attraction = parks
      .find((park) => park.id === parkId)
      ?.attractions.find((item) => item.id === attractionId)
    if (!attraction) return

    const confirmed = window.confirm(
      `Remove ${attraction.name} from this park library? Existing visit history will remain.`,
    )
    if (!confirmed) return

    setParks((currentParks) =>
      currentParks.map((park) =>
        park.id === parkId
          ? {
              ...park,
              attractions: park.attractions.filter(
                (attraction) => attraction.id !== attractionId,
              ),
            }
          : park,
      ),
    )
  }

  function deletePark(parkId: string) {
    const park = parks.find((item) => item.id === parkId)
    if (!park) return

    const confirmed = window.confirm(
      `Remove ${park.name} from your park library? Existing visit history will remain.`,
    )
    if (!confirmed) return

    setParks((currentParks) =>
      currentParks.filter((item) => item.id !== parkId),
    )

    if (visitParkId === parkId) setVisitParkId('')
    if (attractionParkId === parkId) setAttractionParkId('')
  }

  const coasterCategories: Category[] = ['Rollercoaster']
  const rideCategories: Category[] = ['Flat Ride', 'Dark Ride', 'Other']
  const scareCategories: Category[] = ['Scare Maze', 'Scare Zone']

  const allTimeAchievements = calculateCoasterAchievements(allEntries)
  const yearlyAchievements = calculateCoasterAchievements(yearlyEntries)
  const selectedImportCount = importCandidates.filter(
    (candidate) => selectedImports[candidate.sourceId],
  ).length

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">MY ADVENTURE ARCHIVE</p>
        <h1>Theme Park Logbook</h1>
        <p className="hero-copy">Keep every visit, ride and fright in one place.</p>

        <div className="hero-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={openNewVisit}
            disabled={parks.length === 0}
          >
            Log a visit
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setPanel('parks')}
          >
            Manage parks
          </button>
        </div>
      </header>

      <section className="content-section sync-section">
        {!isSupabaseConfigured ? (
          <div className="sync-card warning">
            <span>☁️</span>
            <div>
              <strong>Cloud sync needs its project settings</strong>
              <p>Add the Supabase URL and publishable key to enable sign-in.</p>
            </div>
            <span className="sync-pill local">Local only</span>
          </div>
        ) : !authReady ? (
          <div className="sync-card">
            <span>☁️</span>
            <div>
              <strong>Checking your secure session…</strong>
              <p>Your offline records remain available while this completes.</p>
            </div>
          </div>
        ) : session ? (
          <div className="sync-card">
            <span>☁️</span>
            <div>
              <strong>{session.user.email}</strong>
              <p>Your parks and visits are protected by your Supabase account.</p>
              {lastSyncedAt && (
                <small>Last synced {formatSyncTime(lastSyncedAt)}</small>
              )}
              {authMessage && <small>{authMessage}</small>}
            </div>
            <div className="sync-actions">
              <span className={`sync-pill ${syncStatus}`}>
                {syncStatus === 'loading' && 'Loading…'}
                {syncStatus === 'saving' && 'Saving…'}
                {syncStatus === 'synced' && 'Synced'}
                {syncStatus === 'error' && 'Sync error'}
                {syncStatus === 'local' && 'Local only'}
              </span>
              <button type="button" className="text-button" onClick={handleSyncNow}>
                Sync now
              </button>
              <button type="button" className="text-button" onClick={handleSignOut}>
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <div className="sync-login">
            <div className="sync-intro">
              <span>☁️</span>
              <div>
                <strong>Private cross-device sync</strong>
                <p>Sign in with the same account on your Mac and iPhone.</p>
              </div>
            </div>

            <form className="sync-form" onSubmit={handleAuth}>
              <label>
                Email
                <input
                  type="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  autoComplete={authMode === 'sign-up' ? 'new-password' : 'current-password'}
                  minLength={6}
                  required
                />
              </label>
              <button className="button button-primary" type="submit" disabled={authBusy}>
                {authBusy
                  ? 'Please wait…'
                  : authMode === 'sign-up'
                    ? 'Create account'
                    : 'Sign in'}
              </button>
            </form>

            <div className="auth-footer">
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setAuthMode((mode) => (mode === 'sign-in' ? 'sign-up' : 'sign-in'))
                  setAuthMessage('')
                }}
              >
                {authMode === 'sign-in' ? 'Create an account' : 'I already have an account'}
              </button>
              {authMessage && <p>{authMessage}</p>}
            </div>
          </div>
        )}
      </section>

      {parks.length === 0 && panel !== 'parks' && (
        <section className="content-section onboarding">
          <span className="onboarding-icon">🎢</span>
          <div>
            <p className="eyebrow dark">FIRST STEP</p>
            <h2>Create your park library</h2>
            <p>Add a park and its attractions once, then select them whenever you log a visit.</p>
          </div>
          <button
            type="button"
            className="button button-primary"
            onClick={() => setPanel('parks')}
          >
            Add your first park
          </button>
        </section>
      )}

      {panel === 'parks' && (
        <section className="content-section panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow dark">YOUR LIBRARY</p>
              <h2>Manage parks and attractions</h2>
            </div>
            <button type="button" className="text-button" onClick={() => setPanel(null)}>
              Close
            </button>
          </div>

          <div className="import-card">
            <div className="import-card-heading">
              <div>
                <p className="eyebrow dark">QUICK START</p>
                <h3>Import a current park catalogue</h3>
                <p>
                  Attraction names come from ThemeParks.wiki. Categories and coaster
                  specifications are curated starting points and remain fully editable.
                </p>
              </div>
              <a
                href="https://api.themeparks.wiki/docs/v1/"
                target="_blank"
                rel="noreferrer"
              >
                View source
              </a>
            </div>

            <div className="import-controls">
              <label>
                Park catalogue
                <select
                  value={importParkKey}
                  onChange={(event) => {
                    setImportParkKey(event.target.value)
                    setImportCandidates([])
                    setSelectedImports({})
                    setImportMessage('')
                  }}
                >
                  {PARK_IMPORTS.map((park) => (
                    <option key={park.key} value={park.key}>
                      {park.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="button button-secondary"
                onClick={loadImportPreview}
                disabled={importLoading}
              >
                {importLoading ? 'Loading…' : 'Load attraction list'}
              </button>
            </div>

            {importMessage && <p className="import-message">{importMessage}</p>}

            {importCandidates.length > 0 && (
              <div className="import-preview">
                <div className="import-preview-toolbar">
                  <strong>{selectedImportCount} selected</strong>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      setSelectedImports(
                        Object.fromEntries(
                          importCandidates.map((candidate) => [
                            candidate.sourceId,
                            selectedImportCount !== importCandidates.length,
                          ]),
                        ),
                      )
                    }
                  >
                    {selectedImportCount === importCandidates.length
                      ? 'Deselect all'
                      : 'Select all'}
                  </button>
                </div>

                <ul className="import-preview-list">
                  {importCandidates.map((candidate) => (
                    <li key={candidate.sourceId}>
                      <label>
                        <input
                          type="checkbox"
                          checked={Boolean(selectedImports[candidate.sourceId])}
                          onChange={(event) =>
                            setSelectedImports((current) => ({
                              ...current,
                              [candidate.sourceId]: event.target.checked,
                            }))
                          }
                        />
                        <span>{categoryIcons[candidate.category]}</span>
                        <span>
                          <strong>{candidate.name}</strong>
                          <small>{candidate.category}</small>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  className="button button-primary"
                  onClick={importSelectedAttractions}
                  disabled={selectedImportCount === 0}
                >
                  Import {selectedImportCount} attractions
                </button>
              </div>
            )}
          </div>

          <div className="management-grid">
            <form className="form-card" onSubmit={handleAddPark}>
              <h3>Add a park</h3>
              <label>
                Park name
                <input
                  type="text"
                  value={newParkName}
                  onChange={(event) => setNewParkName(event.target.value)}
                  placeholder="For example, Thorpe Park"
                  required
                />
              </label>
              <button className="button button-primary" type="submit">
                Save park
              </button>
            </form>

            <form className="form-card" onSubmit={handleAddAttraction}>
              <h3>Add an attraction</h3>
              <label>
                Park
                <select
                  value={attractionParkId}
                  onChange={(event) => setAttractionParkId(event.target.value)}
                  required
                  disabled={parks.length === 0 || Boolean(editingAttraction)}
                >
                  <option value="">Choose a park</option>
                  {parks.map((park) => (
                    <option key={park.id} value={park.id}>
                      {park.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Attraction name
                <input
                  type="text"
                  value={newAttractionName}
                  onChange={(event) => setNewAttractionName(event.target.value)}
                  placeholder="For example, Stealth"
                  required
                />
              </label>
              <label>
                Category
                <select
                  value={newAttractionCategory}
                  onChange={(event) =>
                    setNewAttractionCategory(event.target.value as Category)
                  }
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              {newAttractionCategory === 'Rollercoaster' && (
                <div className="coaster-fields">
                  <label>
                    Track length (metres)
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={trackLengthMetres}
                      onChange={(event) => setTrackLengthMetres(event.target.value)}
                      placeholder="For example, 850"
                    />
                  </label>
                  <label>
                    Top speed (mph)
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={topSpeedMph}
                      onChange={(event) => setTopSpeedMph(event.target.value)}
                      placeholder="For example, 50"
                    />
                  </label>
                  <label>
                    Inversions
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={inversions}
                      onChange={(event) => setInversions(event.target.value)}
                      placeholder="For example, 4"
                    />
                  </label>
                </div>
              )}
              <button
                className="button button-primary"
                type="submit"
                disabled={parks.length === 0}
              >
                {editingAttraction ? 'Update attraction' : 'Save attraction'}
              </button>
              {editingAttraction && (
                <button type="button" className="text-button" onClick={resetAttractionForm}>
                  Cancel editing
                </button>
              )}
            </form>
          </div>

          <div className="park-library">
            {parks.map((park) => (
              <article className="park-card" key={park.id}>
                <div className="park-card-heading">
                  <div>
                    <h3>{park.name}</h3>
                    <p>{park.attractions.length} attractions</p>
                  </div>
                  <button
                    type="button"
                    className="delete-link"
                    onClick={() => deletePark(park.id)}
                  >
                    Remove park
                  </button>
                </div>

                {park.attractions.length === 0 ? (
                  <p className="empty-copy">No attractions added yet.</p>
                ) : (
                  <ul className="attraction-library-list">
                    {sortAttractions(park.attractions).map((attraction) => (
                      <li key={attraction.id}>
                        <span>{categoryIcons[attraction.category]}</span>
                        <div>
                          <strong>{attraction.name}</strong>
                          <small>{attraction.category}</small>
                          {attraction.source === 'themeparks-wiki' && (
                            <small>Imported catalogue entry · editable</small>
                          )}
                          {attraction.category === 'Rollercoaster' && (
                            <small>
                              {attraction.trackLengthMetres ?? '—'} m ·{' '}
                              {attraction.topSpeedMph ?? '—'} mph ·{' '}
                              {attraction.inversions ?? '—'} inversions
                            </small>
                          )}
                        </div>
                        <div className="library-actions">
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => startEditingAttraction(park, attraction)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="delete-link"
                            onClick={() => deleteAttraction(park.id, attraction.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {panel === 'visit' && selectedPark && (
        <section className="content-section panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow dark">
                {editingVisitId ? 'UPDATE ENTRY' : 'NEW ENTRY'}
              </p>
              <h2>{editingVisitId ? 'Edit park visit' : 'Log a park visit'}</h2>
            </div>
            <button type="button" className="text-button" onClick={closeVisitPanel}>
              Cancel
            </button>
          </div>

          <form className="visit-form" onSubmit={handleSaveVisit}>
            <div className="visit-details">
              <label>
                Park
                <select
                  value={visitParkId}
                  onChange={(event) => {
                    setVisitParkId(event.target.value)
                    setRideCounts({})
                  }}
                  disabled={Boolean(editingVisitId)}
                  required
                >
                  {parks.map((park) => (
                    <option key={park.id} value={park.id}>
                      {park.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Date
                <input
                  type="date"
                  value={visitDate}
                  onChange={(event) => setVisitDate(event.target.value)}
                  required
                />
              </label>
            </div>

            <div className="ride-selector">
              <div>
                <h3>What did you experience?</h3>
                <p>Select attractions and use the counters as you go.</p>
              </div>

              <section className="visit-live-stats" aria-label="Live visit statistics">
                <article>
                  <span>🎟️</span>
                  <strong aria-live="polite">{visitDraftStats.totalExperiences}</strong>
                  <small>Total experiences</small>
                </article>
                <article>
                  <span>✨</span>
                  <strong>{visitDraftStats.uniqueAttractions}</strong>
                  <small>Unique attractions</small>
                </article>
                <article>
                  <span>🎢</span>
                  <strong>{visitDraftStats.rideExperiences}</strong>
                  <small>Ride experiences</small>
                </article>
                <article>
                  <span>🎃</span>
                  <strong>{visitDraftStats.scareExperiences}</strong>
                  <small>Scare experiences</small>
                </article>
              </section>

              {selectedPark.attractions.length === 0 ? (
                <p className="empty-copy">
                  This park has no attractions yet. You can still save the visit.
                </p>
              ) : (
                <div className="ride-list">
                  {sortAttractions(selectedPark.attractions).map((attraction) => {
                    const selected = (rideCounts[attraction.id] ?? 0) > 0

                    return (
                      <div className={`ride-row${selected ? ' selected' : ''}`} key={attraction.id}>
                        <label className="ride-checkbox">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(event) =>
                              setAttractionSelected(attraction.id, event.target.checked)
                            }
                          />
                          <span className="ride-icon">{categoryIcons[attraction.category]}</span>
                          <span>
                            <strong>{attraction.name}</strong>
                            <small>{attraction.category}</small>
                          </span>
                        </label>
                        <div className="times-field">
                          <span>Times</span>
                          <div className="ride-stepper" role="group" aria-label={`Times ridden on ${attraction.name}`}>
                            <button
                              type="button"
                              aria-label={`Decrease times ridden on ${attraction.name}`}
                              disabled={!selected}
                              onClick={() =>
                                setAttractionCount(
                                  attraction.id,
                                  (rideCounts[attraction.id] ?? 0) - 1,
                                )
                              }
                            >
                              −
                            </button>
                            <output aria-live="polite" aria-label="Times ridden">
                              {rideCounts[attraction.id] ?? 0}
                            </output>
                            <button
                              type="button"
                              aria-label={`Increase times ridden on ${attraction.name}`}
                              disabled={(rideCounts[attraction.id] ?? 0) >= MAX_RIDE_COUNT}
                              onClick={() =>
                                setAttractionCount(
                                  attraction.id,
                                  (rideCounts[attraction.id] ?? 0) + 1,
                                )
                              }
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <button className="button button-primary save-visit" type="submit">
              {editingVisitId ? 'Update visit' : 'Save visit'}
            </button>
          </form>
        </section>
      )}

      {panel === 'visit' && !selectedPark && (
        <section className="content-section panel">
          <h2>Choose a park first</h2>
          <select
            className="standalone-select"
            value={visitParkId}
            onChange={(event) => setVisitParkId(event.target.value)}
          >
            <option value="">Choose a park</option>
            {parks.map((park) => (
              <option key={park.id} value={park.id}>
                {park.name}
              </option>
            ))}
          </select>
        </section>
      )}

      <section className="content-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow dark">ALL-TIME TOTALS</p>
            <h2>Your lifetime stats</h2>
          </div>
        </div>

        <div className="stats-grid">
          <article className="stat-card yellow">
            <span>🎟️</span>
            <strong>{visits.length}</strong>
            <p>Park visits</p>
          </article>
          <article className="stat-card pink">
            <span>🎢</span>
            <strong>{uniqueAttractions(allEntries, coasterCategories)}</strong>
            <p>Unique rollercoasters</p>
            <small>{totalTimes(allEntries, coasterCategories)} total rides</small>
          </article>
          <article className="stat-card cyan">
            <span>🎡</span>
            <strong>{uniqueAttractions(allEntries, rideCategories)}</strong>
            <p>Unique rides</p>
            <small>{totalTimes(allEntries, rideCategories)} total rides</small>
          </article>
          <article className="stat-card orange">
            <span>🎃</span>
            <strong>{uniqueAttractions(allEntries, scareCategories)}</strong>
            <p>Unique scare experiences</p>
            <small>{totalTimes(allEntries, scareCategories)} completions</small>
          </article>
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading year-heading">
          <div>
            <p className="eyebrow dark">THE FUN NUMBERS</p>
            <h2>Coaster achievements</h2>
          </div>
          <label className="year-picker">
            Compare year
            <select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="achievement-period">
          <h3>All time</h3>
          <AchievementCards stats={allTimeAchievements} />
        </div>

        <div className="achievement-period">
          <h3>{selectedYear}</h3>
          <AchievementCards stats={yearlyAchievements} />
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading year-heading">
          <div>
            <p className="eyebrow dark">A YEAR IN RIDES</p>
            <h2>Ride breakdown</h2>
          </div>
          <label className="year-picker">
            Choose year
            <select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="achievement-period">
          <h3>All time</h3>
          <RideBreakdownCards visitCount={visits.length} entries={allEntries} />
        </div>

        <div className="achievement-period">
          <h3>{selectedYear}</h3>
          <RideBreakdownCards
            visitCount={yearlyVisits.length}
            entries={yearlyEntries}
          />
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow dark">YOUR TIMELINE</p>
            <h2>Visit history</h2>
          </div>
        </div>

        {visits.length === 0 ? (
          <div className="empty-state">
            <span>🎫</span>
            <p>Your saved visits will appear here.</p>
          </div>
        ) : (
          <div className="visit-history">
            {visits.map((visit) => (
              <article className="visit-card" key={visit.id}>
                <div className="visit-card-heading">
                  <div>
                    <h3>{visit.parkName}</h3>
                    <p>{formatDate(visit.date)}</p>
                  </div>
                  <div className="visit-card-actions">
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => startEditingVisit(visit)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="delete-link"
                      onClick={() => deleteVisit(visit.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {visit.entries.length === 0 ? (
                  <p className="empty-copy">No attractions recorded for this visit.</p>
                ) : (
                  <ul className="visit-entry-list">
                    {visit.entries.map((entry) => (
                      <li key={entry.attractionId}>
                        <span>{categoryIcons[entry.category]}</span>
                        <div>
                          <strong>{entry.name}</strong>
                          <small>{entry.category}</small>
                        </div>
                        <b>× {entry.times}</b>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

export default App
