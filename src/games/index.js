// Mini-game definitions and location mapping

export const GAME_DEFS = {
  racing: {
    id: 'racing',
    label: 'Racing',
    emoji: '🏎️',
    desc: 'Top-down oval race — beat 2 AI cars in 3 laps',
    coins: 80,
    color: '#f97316',
  },
  shooting: {
    id: 'shooting',
    label: 'Shooting Gallery',
    emoji: '🎯',
    desc: '30 seconds — click targets to score coins',
    coins: 60,
    color: '#ef4444',
  },
  runner: {
    id: 'runner',
    label: 'City Runner',
    emoji: '🏃',
    desc: 'Side-scroll endless runner — jump over obstacles',
    coins: 50,
    color: '#22c55e',
  },
  football: {
    id: 'football',
    label: 'Football',
    emoji: '⚽',
    desc: 'First to 3 goals wins — WASD move, Space kick',
    coins: 70,
    color: '#3b82f6',
  },
  fishing: {
    id: 'fishing',
    label: 'Fishing',
    emoji: '🎣',
    desc: 'Cast and catch fish — timing is everything',
    coins: 40,
    color: '#06b6d4',
  },
}

// Maps building IDs → available game IDs
export const LOCATION_GAMES = {
  arcade:      ['racing', 'shooting'],
  gym:         ['racing', 'runner'],
  mall:        ['racing'],
  rooftop:     ['shooting', 'runner'],
  police:      ['shooting'],
  cinema:      ['shooting'],
  park:        ['football', 'runner'],
  beach:       ['football', 'fishing'],
  cafe:        ['fishing'],
  restaurant:  ['fishing'],
  house1:      ['fishing'],
  house2:      ['fishing'],
}
