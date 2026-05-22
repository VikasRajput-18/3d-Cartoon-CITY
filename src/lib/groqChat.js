// Shared Groq API utility — used by ChatPanel (city NPCs) and AIChat (building NPCs)
// API key lives exclusively in .env.local as VITE_APP_GROQ_SECRET_KEY

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL    = 'llama-3.3-70b-versatile'

/**
 * Send a chat completion request to Groq.
 * messages: Array<{ role: 'user' | 'assistant', content: string }>
 */
export async function groqChat(messages, systemPrompt, maxTokens = 130) {
  const key = import.meta.env.VITE_APP_GROQ_SECRET_KEY
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      temperature: 0.88,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
  })
  if (!res.ok) throw new Error(`Groq ${res.status}`)
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('Empty response')
  return text
}

/** Label for the current in-game time (from timeWeatherState.timeOfDay 0-24). */
export function getTimeLabel(timeOfDay) {
  const h = timeOfDay ?? 12
  if (h >= 5  && h < 12) return 'morning'
  if (h >= 12 && h < 17) return 'afternoon'
  if (h >= 17 && h < 21) return 'evening'
  return 'late night'
}

/** One-sentence weather description for context injection. */
export function getWeatherDesc(weather) {
  return {
    clear:  'The weather is clear and nice.',
    cloudy: "It's a bit cloudy.",
    rainy:  "It's raining right now.",
    foggy:  "There's fog drifting through the city.",
  }[weather] ?? 'The weather is clear.'
}

/**
 * The language-matching rule injected into EVERY system prompt.
 * Forces the model to reply in whatever language the player wrote in.
 */
export const LANGUAGE_RULE = `
LANGUAGE RULE (MOST IMPORTANT — NEVER IGNORE):
Always reply in the EXACT same language and style the player uses.
• Pure Hindi / Devanagari → reply in Hindi
• Pure English → reply in English
• Hinglish (Hindi-English mix) → reply in natural Hinglish
• Any other language → reply in that same language
Never switch languages or force a translation. Mirror the player's language perfectly.`
