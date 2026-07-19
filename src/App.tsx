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
  aggregateRideLogs,
  calculateCoasterAchievements,
  calculateVisitDraftStats,
  clampRideCount,
  countRideLogs,
  getVisitEntries,
  isActiveVisit,
  readRideLogs,
  type CoasterAchievements,
  type RideLog,
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
  entries?: VisitEntry[]
  rideLogs?: RideLog[]
  status?: 'active' | 'completed'
  checkedInAt?: string
  checkedOutAt?: string
}

type Page = 'home' | 'visits' | 'parks' | 'stats'
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

const navigationItems: Array<{ id: Page; label: string; icon: string }> = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'visits', label: 'Visits', icon: '🎟️' },
  { id: 'parks', label: 'Parks', icon: '🎡' },
  { id: 'stats', label: 'Stats', icon: '📊' },
]

const pageDetails: Record<Exclude<Page, 'home'>, { eyebrow: string; title: string; copy: string }> = {
  visits: {
    eyebrow: 'YOUR PARK DAYS',
    title: 'Visits',
    copy: 'Log a new park day or revisit every attraction you experienced.',
  },
  parks: {
    eyebrow: 'YOUR LIBRARY',
    title: 'Parks and attractions',
    copy: 'Build the park and attraction lists you use when recording visits.',
  },
  stats: {
    eyebrow: 'YOUR ADVENTURE IN NUMBERS',
    title: 'Statistics',
    copy: 'Explore lifetime totals, yearly comparisons and coaster achievements.',
  },
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

function getTodayDateInputValue() {
  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${today.getFullYear()}-${month}-${day}`
}

function getTimeOfDay(date: Date): RideLog['timeOfDay'] {
  const hour = date.getHours()
  return hour >= 7 && hour < 19 ? 'day' : 'night'
}

function formatRideLogSummary(rideLog: RideLog) {
  return [
    rideLog.riddenAt ? formatVisitTime(rideLog.riddenAt) : null,
    rideLog.timeOfDay === 'day'
      ? 'Day'
      : rideLog.timeOfDay === 'night'
        ? 'Night'
        : null,
    rideLog.row ? `Row ${rideLog.row}` : null,
    rideLog.seat ? `Seat ${rideLog.seat}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

function formatVisitTime(date: string) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

function formatVisitDuration(start: string, end: string) {
  const totalMinutes = Math.max(
    0,
    Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 60000),
  )
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) return `${minutes} min`
  return `${hours} hr ${minutes} min`
}

function formatSyncTime(date: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
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

function formatVisitTrackDistance(trackKilometres: number) {
  if (trackKilometres === 0) return '0 km'
  if (trackKilometres < 1) return `${Math.round(trackKilometres * 1000)} m`
  return `${trackKilometres.toFixed(1)} km`
}

function VisitFunStats({
  entries,
  live = false,
}: {
  entries: VisitEntry[]
  live?: boolean
}) {
  const stats = calculateCoasterAchievements(entries)

  return (
    <section className="visit-fun-stats-section" aria-label="Fun stats for this visit">
      <div className="visit-fun-stats-heading">
        <span aria-hidden="true">✨</span>
        <div>
          <h4>Fun stats for this visit</h4>
          <p>Calculated from the coaster details in your park library.</p>
        </div>
      </div>
      <div className="visit-fun-stats" aria-live={live ? 'polite' : undefined}>
        <article>
          <span aria-hidden="true">🛤️</span>
          <strong>{formatVisitTrackDistance(stats.trackKilometres)}</strong>
          <small>Track travelled</small>
          <em>{stats.trackMiles.toFixed(1)} miles</em>
        </article>
        <article>
          <span aria-hidden="true">🌀</span>
          <strong>{stats.totalInversions}</strong>
          <small>Inversions</small>
          <em>Across every coaster ride</em>
        </article>
        <article>
          <span aria-hidden="true">⚡️</span>
          <strong>{stats.fastestCoaster?.topSpeedMph ?? 0} mph</strong>
          <small>Fastest coaster</small>
          <em>{stats.fastestCoaster?.name ?? 'No speed recorded'}</em>
        </article>
        <article>
          <span aria-hidden="true">🎢</span>
          <strong>{stats.totalCoasterRides}</strong>
          <small>Coaster rides</small>
          <em>{stats.uniqueCoasters} unique coasters</em>
        </article>
      </div>
    </section>
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
  const [page, setPage] = useState<Page>('home')
  const [visitEditorOpen, setVisitEditorOpen] = useState(false)
  const [checkInOpen, setCheckInOpen] = useState(false)
  const [clockNow, setClockNow] = useState(() => new Date().toISOString())
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
  const [draftRideLogs, setDraftRideLogs] = useState<RideLog[]>([])
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null)
  const activeVisit = visits.find(isActiveVisit)
  const activeVisitId = activeVisit?.id
  const completedVisits = visits.filter((visit) => !isActiveVisit(visit))

  useEffect(() => {
    if (!activeVisitId) return

    const timer = window.setInterval(
      () => setClockNow(new Date().toISOString()),
      60_000,
    )

    return () => window.clearInterval(timer)
  }, [activeVisitId])

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
              version: 3,
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
  const editingActiveVisit = editingVisitId === activeVisit?.id
  const rideCounts = useMemo(
    () => countRideLogs(draftRideLogs),
    [draftRideLogs],
  )
  const visitDraftStats = useMemo(
    () =>
      calculateVisitDraftStats(selectedPark?.attractions ?? [], rideCounts),
    [rideCounts, selectedPark],
  )
  const visitDraftEntries = useMemo<VisitEntry[]>(() => {
    const currentAttractions = new Map(
      (selectedPark?.attractions ?? []).map((attraction) => [
        attraction.id,
        attraction,
      ]),
    )

    return (aggregateRideLogs(draftRideLogs) as VisitEntry[]).map((entry) => {
      const currentAttraction = currentAttractions.get(entry.attractionId)

      return currentAttraction
        ? {
            ...entry,
            name: currentAttraction.name,
            category: currentAttraction.category,
            trackLengthMetres: currentAttraction.trackLengthMetres,
            topSpeedMph: currentAttraction.topSpeedMph,
            inversions: currentAttraction.inversions,
          }
        : entry
    })
  }, [draftRideLogs, selectedPark])

  const attractionLookup = useMemo(
    () =>
      new Map(
        parks.flatMap((park) =>
          park.attractions.map((attraction) => [attraction.id, attraction] as const),
        ),
      ),
    [parks],
  )

  function getVisitDisplayEntries(visit: Visit) {
    return (getVisitEntries(visit) as VisitEntry[]).sort((first, second) =>
      first.name.localeCompare(second.name, 'en-GB', { sensitivity: 'base' }),
    )
  }

  function enrichEntries(selectedVisits: Visit[]) {
    return selectedVisits.flatMap((visit) =>
      getVisitDisplayEntries(visit).map((entry) => {
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
  const activeEntries = activeVisit ? enrichEntries([activeVisit]) : []
  const activeVisitStats = {
    totalExperiences: activeEntries.reduce(
      (total, entry) => total + entry.times,
      0,
    ),
    uniqueAttractions: new Set(
      activeEntries.map((entry) => entry.attractionId),
    ).size,
    rideExperiences: activeEntries
      .filter(
        (entry) =>
          entry.category !== 'Scare Maze' && entry.category !== 'Scare Zone',
      )
      .reduce((total, entry) => total + entry.times, 0),
    scareExperiences: activeEntries
      .filter(
        (entry) =>
          entry.category === 'Scare Maze' || entry.category === 'Scare Zone',
      )
      .reduce((total, entry) => total + entry.times, 0),
  }

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

    const originalVisit = editingVisitId
      ? visits.find((visit) => visit.id === editingVisitId)
      : undefined
    const selectedParkAttractions = new Map(
      selectedPark.attractions.map((attraction) => [attraction.id, attraction]),
    )
    const rideLogs = draftRideLogs.map((rideLog) => {
      const currentAttraction = selectedParkAttractions.get(rideLog.attractionId)

      return currentAttraction
        ? {
            ...rideLog,
            name: currentAttraction.name,
            category: currentAttraction.category,
            trackLengthMetres: currentAttraction.trackLengthMetres,
            topSpeedMph: currentAttraction.topSpeedMph,
            inversions: currentAttraction.inversions,
          }
        : rideLog
    })
    const newVisit: Visit = {
      ...originalVisit,
      id: editingVisitId ?? crypto.randomUUID(),
      parkId: selectedPark.id,
      parkName: selectedPark.name,
      date: visitDate,
      rideLogs,
      status: originalVisit?.status ?? 'completed',
    }
    delete newVisit.entries

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
    setVisitDate(getTodayDateInputValue())
    setDraftRideLogs([])
    if (!visitParkId && parks[0]) setVisitParkId(parks[0].id)
    setPage('visits')
    setCheckInOpen(false)
    setVisitEditorOpen(true)
  }

  function openCheckIn() {
    if (activeVisit) {
      setPage('visits')
      setCheckInOpen(false)
      setVisitEditorOpen(false)
      return
    }

    setEditingVisitId(null)
    setDraftRideLogs([])
    setVisitDate(getTodayDateInputValue())
    if (!visitParkId && parks[0]) setVisitParkId(parks[0].id)
    setPage('visits')
    setVisitEditorOpen(false)
    setCheckInOpen(true)
  }

  function handleCheckIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedPark || activeVisit) return

    const checkedInAt = new Date().toISOString()
    const newVisit: Visit = {
      id: crypto.randomUUID(),
      parkId: selectedPark.id,
      parkName: selectedPark.name,
      date: getTodayDateInputValue(),
      rideLogs: [],
      status: 'active',
      checkedInAt,
    }

    setVisits((currentVisits) => [newVisit, ...currentVisits])
    setClockNow(checkedInAt)
    setCheckInOpen(false)
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
    setDraftRideLogs(readRideLogs(visit))
    setPage('visits')
    setCheckInOpen(false)
    setVisitEditorOpen(true)
  }

  function closeVisitPanel() {
    setEditingVisitId(null)
    setVisitDate('')
    setDraftRideLogs([])
    setVisitEditorOpen(false)
  }

  function checkoutActiveVisit() {
    if (!activeVisit) return

    const confirmed = window.confirm(
      `Check out of ${activeVisit.parkName}? You can still edit this visit later.`,
    )
    if (!confirmed) return

    const checkedOutAt = new Date().toISOString()
    setVisits((currentVisits) =>
      currentVisits.map((visit) =>
        visit.id === activeVisit.id
          ? { ...visit, status: 'completed', checkedOutAt }
          : visit,
      ),
    )
    setVisitEditorOpen(false)
    setCheckInOpen(false)
  }

  function setAttractionSelected(attractionId: string, selected: boolean) {
    setAttractionCount(attractionId, selected ? Math.max(rideCounts[attractionId] ?? 1, 1) : 0)
  }

  function setAttractionCount(attractionId: string, times: number) {
    const attraction = selectedPark?.attractions.find(
      (item) => item.id === attractionId,
    )
    if (!attraction) return

    const nextCount = clampRideCount(times)

    setDraftRideLogs((currentRideLogs) => {
      const matchingLogs = currentRideLogs.filter(
        (rideLog) => rideLog.attractionId === attractionId,
      )
      const otherLogs = currentRideLogs.filter(
        (rideLog) => rideLog.attractionId !== attractionId,
      )

      if (nextCount <= matchingLogs.length) {
        return [...otherLogs, ...matchingLogs.slice(0, nextCount)]
      }

      const additions = Array.from(
        { length: nextCount - matchingLogs.length },
        (): RideLog => {
          const loggedAt = new Date()

          return {
            id: crypto.randomUUID(),
            attractionId: attraction.id,
            name: attraction.name,
            category: attraction.category,
            trackLengthMetres: attraction.trackLengthMetres,
            topSpeedMph: attraction.topSpeedMph,
            inversions: attraction.inversions,
            ...(editingActiveVisit
              ? {
                  riddenAt: loggedAt.toISOString(),
                  timeOfDay: getTimeOfDay(loggedAt),
                }
              : {}),
          }
        },
      )

      return [...otherLogs, ...matchingLogs, ...additions]
    })
  }

  function updateRideLogDetails(
    rideLogId: string,
    details: Partial<Pick<RideLog, 'row' | 'seat' | 'timeOfDay'>>,
  ) {
    setDraftRideLogs((currentRideLogs) =>
      currentRideLogs.map((rideLog) =>
        rideLog.id === rideLogId ? { ...rideLog, ...details } : rideLog,
      ),
    )
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
      <header className="app-navigation">
        <button
          type="button"
          className="nav-brand"
          onClick={() => setPage('home')}
          aria-label="Go to Theme Park Logbook home"
        >
          <span>🎢</span>
          <strong>Park Logbook</strong>
        </button>
        <nav className="primary-nav" aria-label="Main navigation">
          {navigationItems.map((item) => (
            <button
              type="button"
              className={page === item.id ? 'active' : ''}
              aria-current={page === item.id ? 'page' : undefined}
              onClick={() => setPage(item.id)}
              key={item.id}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      {page === 'home' && (
        <header className="hero">
          <p className="eyebrow">MY ADVENTURE ARCHIVE</p>
          <h1>Theme Park Logbook</h1>
          <p className="hero-copy">Keep every visit, ride and fright in one place.</p>

          <div className="hero-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={() => {
                if (activeVisit) {
                  setPage('visits')
                  setVisitEditorOpen(false)
                  setCheckInOpen(false)
                } else {
                  openCheckIn()
                }
              }}
              disabled={parks.length === 0}
            >
              {activeVisit ? 'View active visit' : 'Check in to a park'}
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setPage('parks')}
            >
              Manage parks
            </button>
          </div>
        </header>
      )}

      {page !== 'home' && (
        <section className="page-header">
          <div>
            <p className="eyebrow dark">{pageDetails[page].eyebrow}</p>
            <h1>{pageDetails[page].title}</h1>
            <p>{pageDetails[page].copy}</p>
          </div>
          {page === 'visits' && (
            <div className="page-header-actions">
              <button
                type="button"
                className="button button-primary"
                onClick={() =>
                  activeVisit ? startEditingVisit(activeVisit) : openCheckIn()
                }
                disabled={parks.length === 0}
              >
                {activeVisit ? 'Log rides' : 'Check in'}
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={openNewVisit}
                disabled={parks.length === 0}
              >
                Log past visit
              </button>
            </div>
          )}
        </section>
      )}

      {page === 'home' && <section className="content-section sync-section">
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
      </section>}

      {page === 'home' && parks.length === 0 && (
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
            onClick={() => setPage('parks')}
          >
            Add your first park
          </button>
        </section>
      )}

      {page === 'home' && parks.length > 0 && (
        <section className="content-section home-overview">
          <div className="section-heading">
            <div>
              <p className="eyebrow dark">AT A GLANCE</p>
              <h2>Your logbook</h2>
            </div>
          </div>
          <div className="home-overview-grid">
            <button type="button" onClick={() => setPage('visits')}>
              <span>🎟️</span>
              <strong>{visits.length}</strong>
              <small>Saved visits</small>
              <b>Open visits →</b>
            </button>
            <button type="button" onClick={() => setPage('parks')}>
              <span>🎡</span>
              <strong>{parks.length}</strong>
              <small>Theme parks</small>
              <b>Manage parks →</b>
            </button>
            <button type="button" onClick={() => setPage('stats')}>
              <span>🎢</span>
              <strong>{totalTimes(allEntries, categories)}</strong>
              <small>Total experiences</small>
              <b>View statistics →</b>
            </button>
          </div>
        </section>
      )}

      {page === 'parks' && (
        <section className="content-section panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow dark">PARK DIRECTORY</p>
              <h2>Manage parks and attractions</h2>
            </div>
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

      {page === 'visits' && checkInOpen && (
        <section className="content-section panel check-in-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow dark">START YOUR PARK DAY</p>
              <h2>Check in</h2>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => setCheckInOpen(false)}
            >
              Cancel
            </button>
          </div>
          <form className="check-in-form" onSubmit={handleCheckIn}>
            <label>
              Which park are you visiting?
              <select
                value={visitParkId}
                onChange={(event) => setVisitParkId(event.target.value)}
                required
              >
                <option value="">Choose a park</option>
                {parks.map((park) => (
                  <option key={park.id} value={park.id}>
                    {park.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="check-in-note">
              <span aria-hidden="true">📍</span>
              <div>
                <strong>Your visit starts now</strong>
                <p>
                  Log rides throughout the day, then check out when you leave.
                </p>
              </div>
            </div>
            <button className="button button-primary" type="submit">
              Check in now
            </button>
          </form>
        </section>
      )}

      {page === 'visits' && !visitEditorOpen && !checkInOpen && activeVisit && (
        <section className="content-section active-visit-card">
          <div className="active-visit-heading">
            <div>
              <span className="live-pill">LIVE VISIT</span>
              <h2>{activeVisit.parkName}</h2>
              <p>{formatDate(activeVisit.date)}</p>
              {activeVisit.checkedInAt && (
                <p className="active-visit-time">
                  Checked in at {formatVisitTime(activeVisit.checkedInAt)} ·{' '}
                  {formatVisitDuration(activeVisit.checkedInAt, clockNow)} so far
                </p>
              )}
            </div>
            <div className="active-visit-actions">
              <button
                type="button"
                className="button button-primary"
                onClick={() => startEditingVisit(activeVisit)}
              >
                Log rides
              </button>
              <button
                type="button"
                className="button checkout-button"
                onClick={checkoutActiveVisit}
              >
                Check out
              </button>
            </div>
          </div>

          <section className="visit-live-stats" aria-label="Active visit statistics">
            <article>
              <span>🎟️</span>
              <strong>{activeVisitStats.totalExperiences}</strong>
              <small>Total experiences</small>
            </article>
            <article>
              <span>✨</span>
              <strong>{activeVisitStats.uniqueAttractions}</strong>
              <small>Unique attractions</small>
            </article>
            <article>
              <span>🎢</span>
              <strong>{activeVisitStats.rideExperiences}</strong>
              <small>Ride experiences</small>
            </article>
            <article>
              <span>🎃</span>
              <strong>{activeVisitStats.scareExperiences}</strong>
              <small>Scare experiences</small>
            </article>
          </section>
          <VisitFunStats entries={activeEntries} live />
        </section>
      )}

      {page === 'visits' && visitEditorOpen && selectedPark && (
        <section className="content-section panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow dark">
                {editingActiveVisit
                  ? 'ACTIVE VISIT'
                  : editingVisitId
                    ? 'UPDATE ENTRY'
                    : 'NEW ENTRY'}
              </p>
              <h2>
                {editingActiveVisit
                  ? `Log rides at ${selectedPark.name}`
                  : editingVisitId
                    ? 'Edit park visit'
                    : 'Log a park visit'}
              </h2>
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
                    setDraftRideLogs([])
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

              <VisitFunStats entries={visitDraftEntries} live />

              {selectedPark.attractions.length === 0 ? (
                <p className="empty-copy">
                  This park has no attractions yet. You can still save the visit.
                </p>
              ) : (
                <div className="ride-list">
                  {sortAttractions(selectedPark.attractions).map((attraction) => {
                    const selected = (rideCounts[attraction.id] ?? 0) > 0
                    const attractionRideLogs = draftRideLogs.filter(
                      (rideLog) => rideLog.attractionId === attraction.id,
                    )

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
                        {selected && (
                          <div className="ride-log-details">
                            <div className="ride-log-details-heading">
                              <strong>Individual rides</strong>
                              <small>Add the exact seat and when you rode.</small>
                            </div>
                            {attractionRideLogs.map((rideLog, index) => (
                              <fieldset className="ride-log-card" key={rideLog.id}>
                                <legend>
                                  Ride {index + 1}
                                  {rideLog.riddenAt && (
                                    <span>
                                      Logged at {formatVisitTime(rideLog.riddenAt)}
                                    </span>
                                  )}
                                </legend>
                                <div className="ride-log-fields">
                                  <label>
                                    Row
                                    <input
                                      type="number"
                                      min="1"
                                      step="1"
                                      inputMode="numeric"
                                      aria-label={`Row for ${attraction.name} ride ${index + 1}`}
                                      value={rideLog.row ?? ''}
                                      onChange={(event) =>
                                        updateRideLogDetails(rideLog.id, {
                                          row: event.target.value || undefined,
                                        })
                                      }
                                      placeholder="—"
                                    />
                                  </label>
                                  <label>
                                    Seat
                                    <input
                                      type="number"
                                      min="1"
                                      step="1"
                                      inputMode="numeric"
                                      aria-label={`Seat for ${attraction.name} ride ${index + 1}`}
                                      value={rideLog.seat ?? ''}
                                      onChange={(event) =>
                                        updateRideLogDetails(rideLog.id, {
                                          seat: event.target.value || undefined,
                                        })
                                      }
                                      placeholder="—"
                                    />
                                  </label>
                                  <label>
                                    Ride time
                                    <select
                                      aria-label={`Day or night for ${attraction.name} ride ${index + 1}`}
                                      value={rideLog.timeOfDay ?? ''}
                                      onChange={(event) =>
                                        updateRideLogDetails(rideLog.id, {
                                          timeOfDay:
                                            (event.target.value as RideLog['timeOfDay']) ||
                                            undefined,
                                        })
                                      }
                                    >
                                      <option value="">Choose</option>
                                      <option value="day">Day</option>
                                      <option value="night">Night</option>
                                    </select>
                                  </label>
                                </div>
                              </fieldset>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <button className="button button-primary save-visit" type="submit">
              {editingActiveVisit
                ? 'Save ride updates'
                : editingVisitId
                  ? 'Update visit'
                  : 'Save visit'}
            </button>
          </form>
        </section>
      )}

      {page === 'visits' && visitEditorOpen && !selectedPark && (
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

      {page === 'stats' && (
        <>
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
        </>
      )}

      {page === 'visits' && !visitEditorOpen && !checkInOpen && <section className="content-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow dark">YOUR TIMELINE</p>
            <h2>Visit history</h2>
          </div>
        </div>

        {completedVisits.length === 0 ? (
          <div className="empty-state">
            <span>🎫</span>
            <p>Your completed visits will appear here.</p>
          </div>
        ) : (
          <div className="visit-history">
            {completedVisits.map((visit) => (
              <article className="visit-card" key={visit.id}>
                <div className="visit-card-heading">
                  <div>
                    <h3>{visit.parkName}</h3>
                    <p>{formatDate(visit.date)}</p>
                    {visit.checkedInAt && visit.checkedOutAt && (
                      <small className="visit-session-duration">
                        {formatVisitTime(visit.checkedInAt)}–
                        {formatVisitTime(visit.checkedOutAt)} ·{' '}
                        {formatVisitDuration(
                          visit.checkedInAt,
                          visit.checkedOutAt,
                        )}
                      </small>
                    )}
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

                {getVisitDisplayEntries(visit).length === 0 ? (
                  <p className="empty-copy">No attractions recorded for this visit.</p>
                ) : (
                  <ul className="visit-entry-list">
                    {getVisitDisplayEntries(visit).map((entry) => {
                      const detailedRideLogs = readRideLogs(visit)
                        .filter(
                          (rideLog) =>
                            rideLog.attractionId === entry.attractionId,
                        )
                        .map((rideLog, index) => ({ rideLog, index }))
                        .filter(
                          ({ rideLog }) =>
                            rideLog.row || rideLog.seat || rideLog.timeOfDay,
                        )

                      return (
                        <li key={entry.attractionId}>
                          <span>{categoryIcons[entry.category]}</span>
                          <div>
                            <strong>{entry.name}</strong>
                            <small>{entry.category}</small>
                            {detailedRideLogs.length > 0 && (
                              <div className="ride-log-summary-list">
                                {detailedRideLogs.map(({ rideLog, index }) => (
                                  <span key={rideLog.id}>
                                    Ride {index + 1}: {formatRideLogSummary(rideLog)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <b>× {entry.times}</b>
                        </li>
                      )
                    })}
                  </ul>
                )}
                <VisitFunStats entries={enrichEntries([visit])} />
              </article>
            ))}
          </div>
        )}
      </section>}
    </main>
  )
}

export default App
