// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS — "Storybook Sunset City"
// The single source of truth for every world colour. World geometry must
// reference these instead of inline hex literals.
//
// PERFORMANCE NOTE: CityMerger batches static geometry BY COLOUR, so palette
// discipline is literally draw-call discipline — every ad-hoc hex used to cost
// its own merged mesh. Stick to these tokens.
// ─────────────────────────────────────────────────────────────────────────────

export const C = {
  // ── Architecture ─────────────────────────────────────────────────────────
  wallCream:      '#f2e8d5',   // primary shop/residential walls
  wallSand:       '#e3d3b4',   // secondary walls
  wallTerracotta: '#d9886a',   // warm accent walls
  wallSlate:      '#7e93a8',   // office/cool accent walls
  wallCivic:      '#f7f3ea',   // City Hall, Library, Bank
  roofClay:       '#c75b4a',   // primary roofs
  roofTeal:       '#2e6e73',   // secondary roofs
  roofSlate:      '#3d4a5c',   // office roofs
  trim:           '#8a5a3b',   // doors, beams, wood furniture
  trimDark:       '#5a3e28',   // bench legs, dark wood
  awningRed:      '#e2574c',
  awningTeal:     '#4fb8b2',
  awningGold:     '#f2c94c',
  rooftopUnit:    '#aeb6bf',   // AC boxes, vents, tanks

  // ── Ground & roads ───────────────────────────────────────────────────────
  asphalt:        '#3a3f47',   // main roads (warm dark — lets toon banding read)
  asphaltSec:     '#454b55',   // secondary roads
  curb:           '#9aa3ae',
  sidewalk:       '#cfc8b6',   // warm concrete (kills the blue-gray)
  lanePaint:      '#f4e9c8',   // warm-white markings + crosswalks
  laneYellow:     '#f2c94c',
  plazaPave:      '#e0d6c2',   // plaza light ring
  plazaPaveDark:  '#cfc2a8',   // plaza dark ring
  grass:          '#5e9444',   // city grass base
  grassLight:     '#74ac55',   // tonal patches
  grassDark:      '#4f8438',   // tonal patches (shaded)
  parkGrass:      '#4f8f3f',   // lusher park zones
  path:           '#d8c9a8',   // park gravel paths

  // ── Nature ───────────────────────────────────────────────────────────────
  foliageDark:    '#3e7c3a',
  foliageMid:     '#5da348',
  foliageLight:   '#8cc63f',
  trunk:          '#7a5236',
  flowerRed:      '#e2574c',
  flowerYellow:   '#f2c94c',
  flowerPink:     '#e87ea1',

  // ── Water & beach ────────────────────────────────────────────────────────
  sand:           '#efd9a7',
  sandWet:        '#d9be8c',
  waterShallow:   '#7fd4dc',
  waterDeep:      '#2e8fb8',
  foam:           '#eaf7f7',

  // ── Light & glow ─────────────────────────────────────────────────────────
  windowGlow:     '#ffe566',   // lit windows at night (matches DynamicLighting)
  lampPool:       '#ffd98a',   // fake lamp light-pool discs
  metal:          '#64748b',   // poles, rails, fixtures
}

export default C
