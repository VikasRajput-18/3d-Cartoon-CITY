# 🌍 Cartoon Life Universe — 3D World

A 3D cartoon social world built with React Three Fiber.
Walk around. Chat with NPCs. Do activities. Live your cartoon life.

---

## 🚀 Run it

```bash
npm install
npm run dev
# → http://localhost:5173
```

---

## 🎮 Controls

| Action | How |
|--------|-----|
| Move   | Click anywhere on the ground |
| Chat   | Click any NPC (Anaya, Rahul, Zoya...) |
| Enter a place | Click the floating sign above it |
| Orbit camera  | Right-click + drag (or two-finger drag) |

---

## 🤖 Claude AI (for real conversations)

Without an API key, NPCs use smart fallback responses.

To enable real AI conversations:

1. Get key from [console.anthropic.com](https://console.anthropic.com)
2. Create `.env`:
   ```
   VITE_ANTHROPIC_API_KEY=sk-ant-xxx
   ```
3. In `ChatPanel.jsx` and `PlacePanel.jsx`, uncomment:
   ```js
   'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
   ```

> For production — move API calls to a Node.js backend (Vercel Edge / Railway)

---

## 🏗️ What's in the 3D world

**Places you can enter:**
- ☕ Cafe — chat, coffee, gossip
- 🕹️ Arcade — games, compete
- 🏖️ Beach — swim, dance, flirt
- 🌙 Rooftop — deep talks, stargaze
- 🎵 Music Room — karaoke, DJ, sing
- 🌳 Park — walk, pet, relax

**NPCs wandering the city:**
- 👧 Anaya — bubbly, loves drama
- 👦 Rahul — chill bro, sarcastic
- 👩 Zoya — smart, kind, calm
- 🧑 Kabir — sporty, motivational
- 👩‍🦱 Meera — artistic, mysterious

All NPCs wander randomly and react to being clicked.

---

## 📁 Structure

```
src/
  world/
    WorldCanvas.jsx   ← Full 3D scene (Three.js + R3F)
    Avatar3D.jsx      ← 3D cartoon avatar with walk animation
  components/
    ChatPanel.jsx     ← NPC chat with Claude AI
    PlacePanel.jsx    ← Activity picker + AI outcomes
    HUD.jsx           ← Stats, wallet, event banner overlay
  pages/
    Onboarding.jsx    ← 4-step character creation
    Game.jsx          ← Main game world page
  store/
    index.js          ← Zustand global state
```

---

## 🔧 Tech stack

| Layer | Tool |
|-------|------|
| 3D engine | Three.js + React Three Fiber |
| 3D helpers | @react-three/drei (Stars, Billboard, Text) |
| Framework | React 18 + Vite |
| Styling | Tailwind CSS |
| Animation | Framer Motion |
| State | Zustand (persisted) |
| AI | Claude API (Sonnet 4) |

---

## 🔜 Next features

- Supabase Realtime — see other real players walking around
- glTF avatar models (replace primitive geometry)
- Boss fight arena
- Secret underground tunnel
- Day/night cycle
- Sound effects
