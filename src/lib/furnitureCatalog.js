// Catalog of placeable furniture items for house customization.
// Each item has: id, label, category, emoji, price, type (renderer key), color, w/h/d (bounding box in metres).

export const FURNITURE_CATEGORIES = ['Seating', 'Tables', 'Storage', 'Lighting', 'Decor', 'Electronics', 'Fitness']

export const FURNITURE_ITEMS = [
  // ── Seating ───────────────────────────────────────────────────────────────────
  { id: 'armchair',      label: 'Armchair',       category: 'Seating',     emoji: '🪑', price:  150, type: 'armchair',     color: '#dc2626', w: 0.9,  h: 1.0,  d: 0.9  },
  { id: 'bean_bag',      label: 'Bean Bag',        category: 'Seating',     emoji: '🫘', price:   80, type: 'bean_bag',      color: '#7c3aed', w: 0.9,  h: 0.7,  d: 0.9  },
  { id: 'bar_stool',     label: 'Bar Stool',       category: 'Seating',     emoji: '🪑', price:   60, type: 'bar_stool',     color: '#7c4a1e', w: 0.45, h: 1.0,  d: 0.45 },
  { id: 'sofa_blue',     label: 'Blue Sofa',       category: 'Seating',     emoji: '🛋', price:  220, type: 'sofa',          color: '#2563eb', w: 2.2,  h: 0.9,  d: 0.9  },
  { id: 'sofa_teal',     label: 'Teal Sofa',       category: 'Seating',     emoji: '🛋', price:  350, type: 'sofa',          color: '#0f766e', w: 2.8,  h: 0.9,  d: 0.9  },
  { id: 'rocking_chair', label: 'Rocking Chair',   category: 'Seating',     emoji: '🪑', price:  190, type: 'rocking_chair', color: '#92400e', w: 0.8,  h: 1.1,  d: 0.9  },

  // ── Tables ────────────────────────────────────────────────────────────────────
  { id: 'coffee_table',  label: 'Coffee Table',    category: 'Tables',      emoji: '☕', price:  120, type: 'table_low',     color: '#7c4a1e', w: 1.4,  h: 0.45, d: 0.7  },
  { id: 'dining_table',  label: 'Dining Table',    category: 'Tables',      emoji: '🍽', price:  280, type: 'table_mid',     color: '#92400e', w: 2.0,  h: 0.75, d: 1.0  },
  { id: 'side_table',    label: 'Side Table',      category: 'Tables',      emoji: '📋', price:   70, type: 'table_low',     color: '#a16207', w: 0.6,  h: 0.6,  d: 0.6  },
  { id: 'nightstand',    label: 'Nightstand',      category: 'Tables',      emoji: '🕯', price:   90, type: 'chest',         color: '#5a3d24', w: 0.5,  h: 0.6,  d: 0.45 },
  { id: 'round_table',   label: 'Round Table',     category: 'Tables',      emoji: '⭕', price:  160, type: 'table_round',   color: '#6d4c2f', w: 1.0,  h: 0.75, d: 1.0  },

  // ── Storage ───────────────────────────────────────────────────────────────────
  { id: 'bookshelf',     label: 'Bookshelf',       category: 'Storage',     emoji: '📚', price:  180, type: 'bookshelf',     color: '#7c4a1e', w: 0.35, h: 2.0,  d: 1.5  },
  { id: 'cabinet',       label: 'Cabinet',         category: 'Storage',     emoji: '🗄', price:  200, type: 'cabinet',       color: '#3f3f46', w: 0.45, h: 1.4,  d: 1.2  },
  { id: 'dresser',       label: 'Dresser',         category: 'Storage',     emoji: '🗃', price:  220, type: 'dresser',       color: '#6d4c2f', w: 0.5,  h: 1.0,  d: 1.4  },
  { id: 'toy_chest',     label: 'Toy Chest',       category: 'Storage',     emoji: '📦', price:  100, type: 'chest',         color: '#dc2626', w: 0.5,  h: 0.55, d: 0.9  },
  { id: 'display_case',  label: 'Display Case',    category: 'Storage',     emoji: '🪟', price:  300, type: 'cabinet',       color: '#94a3b8', w: 0.35, h: 1.6,  d: 1.0  },

  // ── Lighting ──────────────────────────────────────────────────────────────────
  { id: 'floor_lamp',    label: 'Floor Lamp',      category: 'Lighting',    emoji: '💡', price:  110, type: 'lamp_floor',    color: '#fbbf24', w: 0.25, h: 1.8,  d: 0.25 },
  { id: 'desk_lamp',     label: 'Desk Lamp',       category: 'Lighting',    emoji: '🔦', price:   60, type: 'lamp_desk',     color: '#fbbf24', w: 0.3,  h: 0.7,  d: 0.3  },
  { id: 'chandelier',    label: 'Chandelier',      category: 'Lighting',    emoji: '🕯', price:  400, type: 'chandelier',    color: '#fbbf24', w: 1.0,  h: 0.6,  d: 1.0  },
  { id: 'neon_sign',     label: 'Neon Sign',       category: 'Lighting',    emoji: '✨', price:  150, type: 'neon',          color: '#ec4899', w: 1.5,  h: 0.4,  d: 0.1  },
  { id: 'fairy_lights',  label: 'Fairy Lights',    category: 'Lighting',    emoji: '🌟', price:   80, type: 'neon',          color: '#fde68a', w: 2.0,  h: 0.15, d: 0.06 },

  // ── Decor ─────────────────────────────────────────────────────────────────────
  { id: 'painting_abs',  label: 'Abstract Art',    category: 'Decor',       emoji: '🎨', price:  200, type: 'painting',      color: '#0ea5e9', w: 0.08, h: 0.9,  d: 1.2  },
  { id: 'painting_nat',  label: 'Nature Scene',    category: 'Decor',       emoji: '🖼', price:  300, type: 'painting',      color: '#22c55e', w: 0.08, h: 1.0,  d: 1.6  },
  { id: 'rug_circle',    label: 'Round Rug',       category: 'Decor',       emoji: '⭕', price:  100, type: 'rug_circle',    color: '#0ea5e9', w: 2.2,  h: 0.05, d: 2.2  },
  { id: 'rug_rect',      label: 'Rect Rug',        category: 'Decor',       emoji: '▬', price:  120, type: 'rug_rect',      color: '#7c3aed', w: 2.0,  h: 0.05, d: 1.2  },
  { id: 'mirror',        label: 'Wall Mirror',     category: 'Decor',       emoji: '🪞', price:  180, type: 'mirror',        color: '#94a3b8', w: 0.08, h: 1.5,  d: 0.9  },
  { id: 'vase',          label: 'Vase',            category: 'Decor',       emoji: '🏺', price:   60, type: 'vase',          color: '#b45309', w: 0.3,  h: 0.7,  d: 0.3  },
  { id: 'plant_tall',    label: 'Tall Plant',      category: 'Decor',       emoji: '🌿', price:   90, type: 'plant_tall',    color: '#16a34a', w: 0.5,  h: 1.8,  d: 0.5  },
  { id: 'plant_pot',     label: 'Potted Plant',    category: 'Decor',       emoji: '🪴', price:   50, type: 'plant',         color: '#16a34a', w: 0.4,  h: 0.8,  d: 0.4  },
  { id: 'fish_tank',     label: 'Fish Tank',       category: 'Decor',       emoji: '🐠', price:  250, type: 'fish_tank',     color: '#0ea5e9', w: 0.25, h: 0.7,  d: 1.0  },
  { id: 'trophy_shelf',  label: 'Trophy Shelf',    category: 'Decor',       emoji: '🏆', price:  120, type: 'trophy_shelf',  color: '#fbbf24', w: 0.2,  h: 0.8,  d: 0.9  },
  { id: 'globe',         label: 'Globe',           category: 'Decor',       emoji: '🌍', price:  130, type: 'globe',         color: '#0ea5e9', w: 0.5,  h: 0.6,  d: 0.5  },

  // ── Electronics ───────────────────────────────────────────────────────────────
  { id: 'gaming_pc',     label: 'Gaming PC',       category: 'Electronics', emoji: '🖥', price:  500, type: 'gaming_pc',     color: '#7c3aed', w: 0.5,  h: 0.7,  d: 0.5  },
  { id: 'speakers',      label: 'Speakers',        category: 'Electronics', emoji: '🔊', price:  200, type: 'speakers',      color: '#0f172a', w: 0.7,  h: 0.6,  d: 0.3  },
  { id: 'mini_fridge',   label: 'Mini Fridge',     category: 'Electronics', emoji: '❄', price:  180, type: 'mini_fridge',   color: '#e2e8f0', w: 0.5,  h: 0.9,  d: 0.5  },
  { id: 'vr_station',    label: 'VR Station',      category: 'Electronics', emoji: '🥽', price:  800, type: 'gaming_pc',     color: '#6366f1', w: 0.6,  h: 0.8,  d: 0.6  },

  // ── Fitness ───────────────────────────────────────────────────────────────────
  { id: 'yoga_mat',      label: 'Yoga Mat',        category: 'Fitness',     emoji: '🧘', price:   40, type: 'rug_rect',      color: '#6366f1', w: 0.6,  h: 0.04, d: 1.8  },
  { id: 'treadmill',     label: 'Treadmill',       category: 'Fitness',     emoji: '🏃', price:  600, type: 'treadmill',     color: '#374151', w: 0.7,  h: 0.8,  d: 1.5  },
  { id: 'dumbbells',     label: 'Dumbbell Rack',   category: 'Fitness',     emoji: '🏋', price:  200, type: 'dumbbell_rack', color: '#374151', w: 0.4,  h: 0.8,  d: 0.8  },
]

export function getCatalogItem(id) {
  return FURNITURE_ITEMS.find(it => it.id === id) ?? null
}
