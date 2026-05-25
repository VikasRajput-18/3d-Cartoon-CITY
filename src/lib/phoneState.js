// Module-level singleton for phone state — avoids prop-drilling.
// Updated by usePhone hook; read by Phone component via React state callbacks.

export const phoneState = {
  // 'idle' | 'outgoing' | 'incoming' | 'active' | 'npc'
  status: 'idle',

  callId:       null,  // Supabase calls.id (for real calls)
  callerId:     null,
  callerName:   null,
  receiverId:   null,
  receiverName: null,

  // elapsed seconds (active call)
  elapsed: 0,

  // missed calls list [{ name, id, ts }]
  missed: [],

  // NPC call state
  npcName: null,
  npcMessages: [],  // [{ role: 'user'|'npc', text }]
}
