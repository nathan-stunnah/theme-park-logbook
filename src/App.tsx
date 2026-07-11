import { useEffect, useState, type FormEvent } from 'react'
import './App.css'

type Visit = {
  id: string
  park: string
  date: string
}

type Category =
  | 'Rollercoaster'
  | 'Flat Ride'
  | 'Dark Ride'
  | 'Scare Maze'
  | 'Scare Zone'
  | 'Other'

type AttractionRecord = {
  id: string
  name: string
  park: string
  date: string
  category: Category
  times: number
}

type OpenForm = 'visit' | 'attraction' | null

const categories: Category[] = [
  'Rollercoaster',
  'Flat Ride',
  'Dark Ride',
  'Scare Maze',
  'Scare Zone',
  'Other',
]

function readSavedData<T>(key: string): T[] {
  const savedData = localStorage.getItem(key)

  if (!savedData) {
    return []
  }

  try {
    return JSON.parse(savedData) as T[]
  } catch {
    return []
  }
}

function App() {
  const [openForm, setOpenForm] = useState<OpenForm>(null)

  const [park, setPark] = useState('')
  const [visitDate, setVisitDate] = useState('')

  const [attractionName, setAttractionName] = useState('')
  const [attractionPark, setAttractionPark] = useState('')
  const [attractionDate, setAttractionDate] = useState('')
  const [category, setCategory] = useState<Category>('Rollercoaster')
  const [times, setTimes] = useState(1)

  const [visits, setVisits] = useState<Visit[]>(() =>
    readSavedData<Visit>('theme-park-visits'),
  )

  const [attractions, setAttractions] = useState<AttractionRecord[]>(() =>
    readSavedData<AttractionRecord>('theme-park-attractions'),
  )

  useEffect(() => {
    localStorage.setItem('theme-park-visits', JSON.stringify(visits))
  }, [visits])

  useEffect(() => {
    localStorage.setItem(
      'theme-park-attractions',
      JSON.stringify(attractions),
    )
  }, [attractions])

  function handleVisitSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const newVisit: Visit = {
      id: crypto.randomUUID(),
      park: park.trim(),
      date: visitDate,
    }

    setVisits((currentVisits) => [newVisit, ...currentVisits])
    setPark('')
    setVisitDate('')
    setOpenForm(null)
  }

  function handleAttractionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const newAttraction: AttractionRecord = {
      id: crypto.randomUUID(),
      name: attractionName.trim(),
      park: attractionPark.trim(),
      date: attractionDate,
      category,
      times,
    }

    setAttractions((currentAttractions) => [
      newAttraction,
      ...currentAttractions,
    ])

    setAttractionName('')
    setAttractionPark('')
    setAttractionDate('')
    setCategory('Rollercoaster')
    setTimes(1)
    setOpenForm(null)
  }

  function deleteVisit(id: string) {
    setVisits((currentVisits) =>
      currentVisits.filter((visit) => visit.id !== id),
    )
  }

  function deleteAttraction(id: string) {
    setAttractions((currentAttractions) =>
      currentAttractions.filter((attraction) => attraction.id !== id),
    )
  }

  const coasterRecords = attractions.filter(
    (attraction) => attraction.category === 'Rollercoaster',
  )

  const rideRecords = attractions.filter((attraction) =>
    ['Flat Ride', 'Dark Ride', 'Other'].includes(attraction.category),
  )

  const scareRecords = attractions.filter((attraction) =>
    ['Scare Maze', 'Scare Zone'].includes(attraction.category),
  )

  const coasterTotal = coasterRecords.reduce(
    (total, attraction) => total + attraction.times,
    0,
  )

  const rideTotal = rideRecords.reduce(
    (total, attraction) => total + attraction.times,
    0,
  )

  const scareTotal = scareRecords.reduce(
    (total, attraction) => total + attraction.times,
    0,
  )

  return (
    <main>
      <header>
        <p>MY ADVENTURE ARCHIVE</p>
        <h1>Theme Park Logbook</h1>
        <p>Keep every visit, ride and fright in one place.</p>

        <div className="hero-actions">
          <button type="button" onClick={() => setOpenForm('visit')}>
            Add a visit
          </button>

          <button type="button" onClick={() => setOpenForm('attraction')}>
            Add an attraction
          </button>
        </div>
      </header>

      {openForm === 'visit' && (
        <section>
          <h2>Add a park visit</h2>

          <form onSubmit={handleVisitSubmit}>
            <label>
              Theme park
              <input
                type="text"
                placeholder="For example, Alton Towers"
                value={park}
                onChange={(event) => setPark(event.target.value)}
                required
              />
            </label>

            <label>
              Date visited
              <input
                type="date"
                value={visitDate}
                onChange={(event) => setVisitDate(event.target.value)}
                required
              />
            </label>

            <div className="form-actions">
              <button type="submit">Save visit</button>

              <button type="button" onClick={() => setOpenForm(null)}>
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {openForm === 'attraction' && (
        <section>
          <h2>Add an attraction</h2>

          <form onSubmit={handleAttractionSubmit}>
            <label>
              Attraction name
              <input
                type="text"
                placeholder="For example, Nemesis Reborn"
                value={attractionName}
                onChange={(event) =>
                  setAttractionName(event.target.value)
                }
                required
              />
            </label>

            <label>
              Theme park
              <input
                type="text"
                placeholder="For example, Alton Towers"
                value={attractionPark}
                onChange={(event) =>
                  setAttractionPark(event.target.value)
                }
                required
              />
            </label>

            <label>
              Category
              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as Category)
                }
              >
                {categories.map((categoryName) => (
                  <option key={categoryName} value={categoryName}>
                    {categoryName}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Date ridden or completed
              <input
                type="date"
                value={attractionDate}
                onChange={(event) =>
                  setAttractionDate(event.target.value)
                }
                required
              />
            </label>

            <label>
              Times ridden or completed
              <input
                type="number"
                min="1"
                max="999"
                value={times}
                onChange={(event) =>
                  setTimes(Number(event.target.value))
                }
                required
              />
            </label>

            <div className="form-actions">
              <button type="submit">Save attraction</button>

              <button type="button" onClick={() => setOpenForm(null)}>
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <section>
        <h2>Your lifetime stats</h2>

        <div>
          <article>
            <span>🎟️</span>
            <strong>{visits.length}</strong>
            <p>Park visits</p>
          </article>

          <article>
            <span>🎢</span>
            <strong>{coasterTotal}</strong>
            <p>Rollercoaster rides</p>
          </article>

          <article>
            <span>🎡</span>
            <strong>{rideTotal}</strong>
            <p>Flat, dark and other rides</p>
          </article>

          <article>
            <span>🎃</span>
            <strong>{scareTotal}</strong>
            <p>Mazes and scare zones</p>
          </article>
        </div>
      </section>

      {attractions.length > 0 && (
        <section>
          <h2>Attraction history</h2>

          <ul className="visit-list">
            {attractions.map((attraction) => (
              <li key={attraction.id}>
                <div>
                  <strong>{attraction.name}</strong>
                  <span>
                    {attraction.category} · {attraction.park}
                  </span>
                  <span>
                    {attraction.date} · {attraction.times} time
                    {attraction.times === 1 ? '' : 's'}
                  </span>
                </div>

                <button
                  type="button"
                  className="delete-button"
                  onClick={() => deleteAttraction(attraction.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {visits.length > 0 && (
        <section>
          <h2>Recent visits</h2>

          <ul className="visit-list">
            {visits.map((visit) => (
              <li key={visit.id}>
                <div>
                  <strong>{visit.park}</strong>
                  <span>{visit.date}</span>
                </div>

                <button
                  type="button"
                  className="delete-button"
                  onClick={() => deleteVisit(visit.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}

export default App