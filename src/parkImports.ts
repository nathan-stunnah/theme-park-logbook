import type { Category } from './App'

export type AttractionOverride = {
  category: Category
  trackLengthMetres?: number
  topSpeedMph?: number
  inversions?: number
}

export type ParkImportDefinition = {
  key: string
  name: string
  entityId: string
  overrides: Record<string, AttractionOverride>
}

const coaster = (
  trackLengthMetres?: number,
  topSpeedMph?: number,
  inversions?: number,
): AttractionOverride => ({
  category: 'Rollercoaster',
  trackLengthMetres,
  topSpeedMph,
  inversions,
})

const ride = (category: Category): AttractionOverride => ({ category })

export const PARK_IMPORTS: ParkImportDefinition[] = [
  {
    key: 'alton-towers',
    name: 'Alton Towers',
    entityId: '0d8ea921-37b1-4a9a-b8ef-5b45afea847b',
    overrides: {
      Galactica: coaster(840, 47, 2),
      'Nemesis Reborn': coaster(716, 50, 4),
      Oblivion: coaster(372.5, 68, 0),
      'Octonauts Rollercoaster Adventure': coaster(),
      Rita: coaster(640, 61, 0),
      'Runaway Mine Train': coaster(),
      'Spinball Whizzer': coaster(450, 37, 0),
      TH13TEEN: coaster(756, 42, 0),
      'The Smiler': coaster(1170, 53, 14),
      'Wicker Man': coaster(795, 44, 0),
      'Battle Galleons': ride('Other'),
      'Bugbie-Go-Round': ride('Flat Ride'),
      'Congo River Rapids': ride('Other'),
      'Cuckoo Cars Driving School': ride('Other'),
      'Gangsta Granny: The Ride': ride('Dark Ride'),
      'Go Jetters Vroomster Zoom Ride': ride('Flat Ride'),
      'Heave Ho': ride('Flat Ride'),
      'Hex - The Legend of the Towers': ride('Dark Ride'),
      'In The Night Garden Magical Boat Ride': ride('Dark Ride'),
      "Justin's House Pie-O-Matic Factory": ride('Other'),
      "Marauder's Mayhem": ride('Flat Ride'),
      'Nemesis Sub-Terra': ride('Dark Ride'),
      'Peter Rabbit Hippity Hop': ride('Flat Ride'),
      'The Curse at Alton Manor': ride('Dark Ride'),
      'The Royal Carousel': ride('Flat Ride'),
      Toxicator: ride('Flat Ride'),
    },
  },
  {
    key: 'thorpe-park',
    name: 'Thorpe Park',
    entityId: 'b08d9272-d070-4580-9fcd-375270b191a7',
    overrides: {
      Colossus: coaster(850, 45, 10),
      'Flying Fish': coaster(),
      Hyperia: coaster(995, 81, 2),
      'Nemesis Inferno': coaster(750, 48, 4),
      'SAW - The Ride': coaster(720, 55, 3),
      Stealth: coaster(400, 80, 0),
      'The Swarm': coaster(775, 59, 5),
      'The Walking Dead©: The Ride': coaster(),
      'Big Easy Bumpers': ride('Flat Ride'),
      'Depth Charge': ride('Other'),
      Detonator: ride('Flat Ride'),
      'Dobble Tea Party': ride('Flat Ride'),
      'Ghost Train': ride('Dark Ride'),
      'High Striker': ride('Flat Ride'),
      "Mr Monkey's Banana Ride": ride('Flat Ride'),
      Quantum: ride('Flat Ride'),
      Rush: ride('Flat Ride'),
      Samurai: ride('Flat Ride'),
      'Storm Surge': ride('Other'),
      'Tidal Wave': ride('Other'),
      Vortex: ride('Flat Ride'),
      Zodiac: ride('Flat Ride'),
    },
  },
  {
    key: 'blackpool-pleasure-beach',
    name: 'Blackpool Pleasure Beach',
    entityId: '3782a489-b9ca-428f-8bb5-4de4fc38d815',
    overrides: {
      Avalanche: coaster(454.2, 50, 0),
      'Big Dipper': coaster(1005.8, 40, 0),
      'Big One': coaster(1675.5, 74, 0),
      'Blue Flyer': coaster(335.3, 25, 0),
      'Grand National': coaster(1006, 40, 0),
      ICON: coaster(1143, 53, 2),
      Infusion: coaster(689, 50, 5),
      'Nickelodeon Streak': coaster(699, 35, 0),
      Revolution: coaster(193, 45, 1),
      Steeplechase: coaster(388.6, 25, 0),
      'Alice in Wonderland': ride('Dark Ride'),
      'Avatar Airbender': ride('Flat Ride'),
      'Backyardigans Pirate Treasure': ride('Other'),
      'Bikini Bottom Bus Tour': ride('Flat Ride'),
      'Derby Racer': ride('Flat Ride'),
      "Diego's Rainforest Rescue": ride('Flat Ride'),
      "Dora's World Voyage": ride('Dark Ride'),
      'Fairy World Taxi Spin': ride('Flat Ride'),
      'Flying Machines': ride('Flat Ride'),
      'Ghost Train': ride('Dark Ride'),
      'Krusty Krab Order Up': ride('Flat Ride'),
      'Pleasure Beach Express': ride('Other'),
      'Rugrats Lost River': ride('Other'),
      "SpongeBob's Splash Bash": ride('Flat Ride'),
      Valhalla: ride('Dark Ride'),
      "Wallace & Gromit's Thrill-o-Matic": ride('Dark Ride'),
      'Wonderpets Big Circus Bounce': ride('Flat Ride'),
    },
  },
]
