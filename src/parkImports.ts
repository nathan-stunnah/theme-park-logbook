import type { Category } from './App'

export type AttractionOverride = { category: Category; trackLengthMetres?: number; topSpeedMph?: number; inversions?: number }
export type ParkImportDefinition = { key: string; name: string; rcdbUrl: string; overrides: Record<string, AttractionOverride> }
const coaster = (trackLengthMetres?: number, topSpeedMph?: number, inversions?: number): AttractionOverride => ({ category: 'Rollercoaster', trackLengthMetres, topSpeedMph, inversions })

export const PARK_IMPORTS: ParkImportDefinition[] = [
  { key: 'alton-towers', name: 'Alton Towers', rcdbUrl: 'https://rcdb.com/4796.htm', overrides: {
    Galactica: coaster(840,47,2), 'Nemesis Reborn': coaster(716,50,4), Oblivion: coaster(372.5,68,0), 'Octonauts Rollercoaster Adventure': coaster(), Rita: coaster(640,61,0), 'Runaway Mine Train': coaster(), 'Spinball Whizzer': coaster(450,37,0), TH13TEEN: coaster(756,42,0), 'The Smiler': coaster(1170,53,14), 'Wicker Man': coaster(795,44,0),
  }},
  { key: 'thorpe-park', name: 'Thorpe Park', rcdbUrl: 'https://rcdb.com/4821.htm', overrides: {
    Colossus: coaster(850,45,10), 'Flying Fish': coaster(), Hyperia: coaster(995,81,2), 'Nemesis Inferno': coaster(750,48,4), 'SAW - The Ride': coaster(720,55,3), Stealth: coaster(400,80,0), 'The Swarm': coaster(775,59,5), 'The Walking Dead: The Ride': coaster(),
  }},
  { key: 'chessington', name: 'Chessington World of Adventures', rcdbUrl: 'https://rcdb.com/4798.htm', overrides: {
    "Dragon's Fury": coaster(520,0,0), 'Mandrill Mayhem': coaster(380,44.7,1), "Chase's Mountain Mission": coaster(), Vampire: coaster(670.6,45,0), Rattlesnake: coaster(),
  }},
  { key: 'blackpool', name: 'Blackpool Pleasure Beach', rcdbUrl: 'https://rcdb.com/4795.htm', overrides: {
    Avalanche: coaster(454.2,0,0), 'Big Dipper': coaster(1005.8,40,0), 'Big One': coaster(1675.5,74,0), 'Blue Flyer': coaster(335.3,25,0), 'Grand National': coaster(1006,40,0), Icon: coaster(1143,52.8,1), Infusion: coaster(689,49.7,5), 'Nickelodeon Streak': coaster(699,35,0), Revolution: coaster(193.5,45,1), Steeplechase: coaster(388.6,25,0),
  }},
  { key: 'elitch-gardens', name: 'Elitch Gardens', rcdbUrl: 'https://rcdb.com/4527.htm', overrides: {
    'Blazin’ Buckaroo': coaster(), Boomerang: coaster(), 'Half Pipe': coaster(), 'Mind Eraser': coaster(), Sidewinder: coaster(), 'Twister III: Storm Chaser': coaster(),
  }},
  { key: 'magic-kingdom', name: 'Magic Kingdom', rcdbUrl: 'https://rcdb.com/4574.htm', overrides: {
    'The Barnstormer': coaster(), 'Big Thunder Mountain Railroad': coaster(), 'Seven Dwarfs Mine Train': coaster(), 'Space Mountain': coaster(), 'TRON Lightcycle / Run': coaster(),
  }},
  { key: 'epcot', name: 'Epcot', rcdbUrl: 'https://rcdb.com/4566.htm', overrides: { 'Guardians of the Galaxy: Cosmic Rewind': coaster() }},
  { key: 'animal-kingdom', name: 'Animal Kingdom', rcdbUrl: 'https://rcdb.com/4581.htm', overrides: { 'Expedition Everest': coaster() }},
  { key: 'hollywood-studios', name: 'Hollywood Studios', rcdbUrl: 'https://rcdb.com/4579.htm', overrides: { "Rock 'n' Roller Coaster": coaster(), 'Slinky Dog Dash': coaster() }},
  { key: 'disneyland-paris', name: 'Disneyland Park (Paris)', rcdbUrl: 'https://rcdb.com/4790.htm', overrides: {
    'Big Thunder Mountain': coaster(), 'Casey Jr. - le Petit Train du Cirque': coaster(), 'Indiana Jones et le Temple du Péril': coaster(), 'Star Wars Hyperspace Mountain': coaster(),
  }},
  { key: 'adventure-world-paris', name: 'Disney Adventure World (Paris)', rcdbUrl: 'https://rcdb.com/4791.htm', overrides: {
    'Avengers Assemble: Flight Force': coaster(), "Crush's Coaster": coaster(), 'RC Racer': coaster(),
  }},
]
