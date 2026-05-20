import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useStore = create(
  persist(
    (set, get) => ({
      // Avatar
      avatar: { name: 'You', skin: '#F4C08A', hair: '#2C1810', outfit: 'casual', expression: 'happy' },
      setAvatar: (u) => set(s => ({ avatar: { ...s.avatar, ...u } })),

      // Stats
      stats: { hunger: 80, sleep: 70, hygiene: 90, social: 60, fun: 75 },
      updateStats: (d) => set(s => {
        const n = { ...s.stats }
        Object.entries(d).forEach(([k, v]) => { n[k] = Math.max(0, Math.min(100, (n[k] ?? 50) + v)) })
        return { stats: n }
      }),

      // Wallet
      wallet: { coins: 500, gems: 10, tickets: 3 },
      addCoins: (n) => set(s => ({ wallet: { ...s.wallet, coins: s.wallet.coins + n } })),

      // World state
      currentPlace: 'city',
      playerPos: [0, 0, 0],
      setPlayerPos: (p) => set({ playerPos: p }),
      setPlace: (p) => set({ currentPlace: p }),

      // Chat
      activeNPC: null,
      setActiveNPC: (npc) => set({ activeNPC: npc }),
      chatHistory: {},
      addMessage: (npcId, msg) => set(s => ({
        chatHistory: {
          ...s.chatHistory,
          [npcId]: [...(s.chatHistory[npcId] || []), msg]
        }
      })),

      // Mood
      mood: 'happy',
      setMood: (m) => set({ mood: m }),

      // Onboarding
      isOnboarded: false,
      completeOnboarding: (name) => set(s => ({ isOnboarded: true, avatar: { ...s.avatar, name } })),

      // Notifications
      toasts: [],
      toast: (msg, type = 'info') => {
        const id = Date.now()
        set(s => ({ toasts: [...s.toasts, { id, msg, type }] }))
        setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 3200)
      },

      reset: () => set({ isOnboarded: false }),
    }),
    { name: 'clu-3d-store', partialize: s => ({ avatar: s.avatar, stats: s.stats, wallet: s.wallet, isOnboarded: s.isOnboarded }) }
  )
)
