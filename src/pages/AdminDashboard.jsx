import { useState, useEffect, useCallback, useRef } from 'react'
import { useUser, useClerk } from '@clerk/clerk-react'
import { Navigate } from 'react-router-dom'
import { isAdminUser } from '@/lib/adminConfig'
import * as AS from '@/lib/adminService'
import { GAME_IDS, GAME_NAMES, GAME_EMOJIS } from '@/lib/gameState'

// ── Shared style constants ─────────────────────────────────────────────────────
const S = {
  bg:         '#050311',
  sidebar:    '#0a0619',
  card:       'rgba(255,255,255,0.04)',
  cardBorder: 'rgba(255,255,255,0.08)',
  accent:     '#7c3aed',
  accentLight:'#a78bfa',
  text:       '#e2e8f0',
  textMuted:  '#64748b',
  danger:     '#ef4444',
  success:    '#22c55e',
  warning:    '#f59e0b',
}

const btn = (color='#7c3aed', extra={}) => ({
  background: color, border: 'none', borderRadius: 8, color: '#fff',
  padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700,
  fontFamily: 'inherit', ...extra,
})

const input = {
  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, color: S.text, padding: '8px 12px', fontSize: 13,
  fontFamily: 'inherit', outline: 'none', width: '100%',
}

const card = {
  background: S.card, border: `1px solid ${S.cardBorder}`,
  borderRadius: 12, padding: '16px 18px',
}

// ── Reusable components ────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color = S.accentLight, sub }) {
  return (
    <div style={{ ...card, flex: '1 1 160px' }}>
      <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value ?? '—'}</div>
      <div style={{ fontSize: 12, color: S.textMuted, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: S.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function MiniBarChart({ data, color = S.accentLight, height = 60 }) {
  if (!data?.length) return null
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height, width: '100%' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div style={{ width: '100%', background: color, borderRadius: '3px 3px 0 0', opacity: 0.85,
            height: `${Math.max(4, Math.floor((d.value / max) * height))}px`, transition: 'height 0.3s' }} />
          <div style={{ fontSize: 9, color: S.textMuted, whiteSpace: 'nowrap' }}>
            {d.date?.slice(5)}
          </div>
        </div>
      ))}
    </div>
  )
}

function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ ...card, maxWidth: 360, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: S.text }}>{title}</div>
        <div style={{ fontSize: 13, color: S.textMuted, marginBottom: 20 }}>{message}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btn(S.danger)} onClick={onConfirm}>Confirm</button>
          <button style={btn('rgba(255,255,255,0.1)')} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ children }) {
  return <div style={{ fontSize: 18, fontWeight: 800, color: S.text, marginBottom: 18 }}>{children}</div>
}

function Table({ cols, rows, onRowClick }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c} style={{ textAlign: 'left', padding: '8px 10px', color: S.textMuted,
                fontWeight: 700, borderBottom: `1px solid ${S.cardBorder}`, whiteSpace: 'nowrap' }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} onClick={() => onRowClick?.(row)}
              style={{ borderBottom: `1px solid rgba(255,255,255,0.04)`, cursor: onRowClick ? 'pointer' : 'default' }}
              onMouseEnter={e => onRowClick && (e.currentTarget.style.background = 'rgba(124,58,237,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              {row.cells.map((cell, j) => (
                <td key={j} style={{ padding: '9px 10px', color: S.text, whiteSpace: 'nowrap' }}>{cell}</td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={cols.length} style={{ padding: 24, textAlign: 'center', color: S.textMuted }}>No data</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ── Section: Overview ─────────────────────────────────────────────────────────
function OverviewSection({ adminId }) {
  const [stats,    setStats]   = useState(null)
  const [feed,     setFeed]    = useState([])
  const [daily,    setDaily]   = useState([])

  const load = useCallback(async () => {
    const [s, f, d] = await Promise.all([AS.getOverviewStats(), AS.getActivityFeed(), AS.getDailyStats(7)])
    setStats(s); setFeed(f); setDaily(d)
  }, [])

  useEffect(() => { load(); const iv = setInterval(load, 30000); return () => clearInterval(iv) }, [load])

  return (
    <div>
      <SectionTitle>📊 Overview</SectionTitle>

      {/* Top stats row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <StatCard icon="👥" label="Total Players"    value={stats?.totalPlayers}  color={S.accentLight} />
        <StatCard icon="🟢" label="Online Now"       value={stats?.onlinePlayers} color={S.success} />
        <StatCard icon="🆕" label="New Today"        value={stats?.newToday}      color={S.warning} />
        <StatCard icon="🪙" label="Coins in Circulation" value={stats?.totalCoins?.toLocaleString()} color='#facc15' />
        <StatCard icon="🏆" label="Active Tournaments" value={stats?.activeTournaments} color='#f97316' />
      </div>

      {/* Charts + Feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
        <div>
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: S.textMuted, marginBottom: 12 }}>NEW REGISTRATIONS — LAST 7 DAYS</div>
            <MiniBarChart data={daily} color={S.accentLight} height={80} />
          </div>
        </div>

        {/* Activity feed */}
        <div style={{ ...card, maxHeight: 400, overflowY: 'auto' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: S.textMuted, marginBottom: 10 }}>⚡ LIVE ACTIVITY</div>
          {feed.length === 0
            ? <div style={{ color: S.textMuted, fontSize: 12, padding: '8px 0' }}>No recent activity</div>
            : feed.map((e, i) => (
                <div key={i} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)`, padding: '6px 0' }}>
                  <div style={{ fontSize: 11, color: S.accentLight, fontWeight: 600 }}>{e.action}</div>
                  <div style={{ fontSize: 10, color: S.textMuted }}>{new Date(e.created_at).toLocaleTimeString()} — {e.target_player || e.admin_id}</div>
                </div>
              ))
          }
        </div>
      </div>
    </div>
  )
}

// ── Section: Players ──────────────────────────────────────────────────────────
function PlayersSection({ adminId }) {
  const [players, setPlayers]   = useState([])
  const [total,   setTotal]     = useState(0)
  const [page,    setPage]      = useState(0)
  const [search,  setSearch]    = useState('')
  const [loadErr, setLoadErr]   = useState(null)
  const [selected, setSelected] = useState(null)  // player detail
  const [detail,   setDetail]   = useState(null)
  const [confirm,  setConfirm]  = useState(null)
  const [giftForm, setGiftForm] = useState(null)  // { type: 'coins'|'gems', uid, name }
  const [giftAmt,  setGiftAmt]  = useState(100)
  const [giftMsg,  setGiftMsg]  = useState('')
  const [banForm,  setBanForm]  = useState(null)
  const [banReason, setBanReason] = useState('cheating')
  const [banDuration, setBanDuration] = useState(7)
  const [toast, setToast] = useState(null)

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const loadPlayers = useCallback(async () => {
    const r = await AS.getPlayers({ search, page })
    setPlayers(r.data); setTotal(r.total); setLoadErr(r.error || null)
  }, [search, page])

  useEffect(() => { loadPlayers() }, [loadPlayers])

  const openDetail = async (p) => {
    setSelected(p)
    const d = await AS.getPlayerDetail(p.id)
    setDetail(d)
  }

  const isBanned = (p) => p.banned_until && new Date(p.banned_until) > new Date()

  const banReasons = ['cheating', 'harassment', 'payment fraud', 'spam', 'other']
  const banDurations = [{ label: '1 day', val: 1 }, { label: '7 days', val: 7 }, { label: '30 days', val: 30 }, { label: 'Permanent', val: 'permanent' }]

  return (
    <div>
      <SectionTitle>👥 Players</SectionTitle>
      {toast && (
        <div style={{ ...card, background: toast.ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
          border: `1px solid ${toast.ok ? S.success : S.danger}`, color: toast.ok ? S.success : S.danger,
          marginBottom: 12, fontSize: 13 }}>{toast.msg}</div>
      )}

      {/* Search */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <input style={{ ...input, flex: 1 }} placeholder="Search by name or ID…" value={search}
          onChange={e => { setSearch(e.target.value); setPage(0) }} />
        <button style={btn()} onClick={loadPlayers}>Search</button>
      </div>

      {/* DB error / empty-state banner — usually RLS or a missing column */}
      {(loadErr || (!search && players.length === 0)) && (
        <div style={{ ...card, background: loadErr ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.1)',
          border: `1px solid ${loadErr ? S.danger : S.warning}`,
          color: loadErr ? '#fca5a5' : '#fde68a', marginBottom: 12, fontSize: 12, lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {loadErr ? '⚠️ Could not load players' : 'ℹ️ No players showing'}
          </div>
          {loadErr && <div style={{ color: '#fecaca', fontFamily: 'monospace', fontSize: 11 }}>{loadErr}</div>}
          <div style={{ color: S.textMuted, marginTop: 8 }}>
            If you know players exist, the <b>players</b> table likely has Row Level Security with no
            SELECT policy for the anon key (RLS silently returns zero rows). Run this in the Supabase SQL editor:
          </div>
          <pre style={{ background: 'rgba(0,0,0,0.4)', padding: 10, borderRadius: 6, marginTop: 6,
            color: '#a7f3d0', fontSize: 11, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
{`create policy "admin read players" on players
  for select using (true);`}</pre>
        </div>
      )}

      {/* Table */}
      <div style={card}>
        <Table
          cols={['Name', 'Coins', 'Gems', 'Streak', 'Status', 'Actions']}
          rows={players.map(p => ({
            _raw: p,
            cells: [
              p.name || p.id?.slice(-8),
              `🪙 ${p.coins ?? 0}`,
              `💎 ${p.gems ?? 0}`,
              `🔥 ${p.login_streak ?? 0}`,
              isBanned(p) ? '🚫 Banned' : (p.is_online ? '🟢 Online' : '⚫ Offline'),
              <div key="acts" style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                <button style={btn('#334155', { fontSize: 10 })} onClick={() => openDetail(p)}>Detail</button>
                <button style={btn('#7c3aed', { fontSize: 10 })} onClick={() => { setGiftForm({ type: 'coins', uid: p.id, name: p.name }) }}>Gift</button>
                {!isBanned(p)
                  ? <button style={btn(S.danger, { fontSize: 10 })} onClick={() => setBanForm(p)}>Ban</button>
                  : <button style={btn(S.success, { fontSize: 10 })} onClick={async () => { await AS.unbanPlayer(adminId, p.id); showToast(`Unbanned ${p.name}`); loadPlayers() }}>Unban</button>
                }
              </div>,
            ],
          }))}
          onRowClick={p => openDetail(p._raw)}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
          <button style={btn('#334155')} disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span style={{ fontSize: 12, color: S.textMuted }}>Page {page + 1} · {total} total</span>
          <button style={btn('#334155')} disabled={(page + 1) * 20 >= total} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      </div>

      {/* Player detail panel */}
      {selected && (
        <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 380, background: S.sidebar,
          borderLeft: `1px solid ${S.cardBorder}`, overflowY: 'auto', zIndex: 500, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: S.text }}>{selected.name || selected.id}</div>
            <button style={btn('#334155')} onClick={() => { setSelected(null); setDetail(null) }}>✕ Close</button>
          </div>
          {detail ? (
            <>
              <div style={{ ...card, marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: S.textMuted, marginBottom: 8 }}>WALLET</div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div><div style={{ color: '#facc15', fontWeight: 700 }}>🪙 {detail.player?.coins ?? 0}</div><div style={{ fontSize: 10, color: S.textMuted }}>Coins</div></div>
                  <div><div style={{ color: '#a78bfa', fontWeight: 700 }}>💎 {detail.player?.gems ?? 0}</div><div style={{ fontSize: 10, color: S.textMuted }}>Gems</div></div>
                  <div><div style={{ color: '#34d399', fontWeight: 700 }}>🎟 {detail.player?.tickets ?? 0}</div><div style={{ fontSize: 10, color: S.textMuted }}>Tickets</div></div>
                </div>
              </div>
              {detail.stats && (
                <div style={{ ...card, marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: S.textMuted, marginBottom: 8 }}>GAME STATS</div>
                  <div style={{ fontSize: 12, color: S.text }}>🏆 {detail.stats.total_wins}W / 💀 {detail.stats.total_losses}L / {detail.stats.total_games} games</div>
                  <div style={{ fontSize: 12, color: '#facc15', marginTop: 4 }}>Coins from games: {detail.stats.coins_earned_from_games}</div>
                </div>
              )}
              <div style={{ fontSize: 11, color: S.textMuted, marginBottom: 8, marginTop: 4 }}>RECENT SCORES</div>
              {detail.scores.slice(0, 5).map((s, i) => (
                <div key={i} style={{ fontSize: 11, color: S.text, borderBottom: `1px solid rgba(255,255,255,0.05)`, padding: '4px 0' }}>
                  {GAME_EMOJIS[s.game_id]} {s.score} · {new Date(s.created_at).toLocaleDateString()}
                </div>
              ))}
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button style={btn('#7c3aed')} onClick={() => setGiftForm({ type: 'coins', uid: selected.id, name: selected.name })}>🪙 Give Coins</button>
                <button style={btn('#6d28d9')} onClick={() => setGiftForm({ type: 'gems', uid: selected.id, name: selected.name })}>💎 Give Gems</button>
                <button style={btn(S.danger)} onClick={() => setBanForm(selected)}>🚫 Ban Player</button>
              </div>
            </>
          ) : <div style={{ color: S.textMuted, fontSize: 13 }}>Loading…</div>}
        </div>
      )}

      {/* Give coins/gems modal */}
      {giftForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9000,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ ...card, width: 320, boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14, color: S.text }}>
              {giftForm.type === 'coins' ? '🪙 Give Coins' : '💎 Give Gems'} to {giftForm.name}
            </div>
            <input style={{ ...input, marginBottom: 8 }} type="number" min={1} value={giftAmt}
              onChange={e => setGiftAmt(+e.target.value)} placeholder="Amount" />
            <input style={{ ...input, marginBottom: 14 }} value={giftMsg}
              onChange={e => setGiftMsg(e.target.value)} placeholder="Reason (optional)" />
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btn()} onClick={async () => {
                const ok = giftForm.type === 'coins'
                  ? await AS.giveCoins(adminId, giftForm.uid, giftAmt, giftMsg)
                  : await AS.giveGems(adminId, giftForm.uid, giftAmt, giftMsg)
                setGiftForm(null); showToast(ok ? `Gifted ${giftAmt} ${giftForm.type}` : 'Failed')
                loadPlayers()
              }}>Send</button>
              <button style={btn('#334155')} onClick={() => setGiftForm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Ban modal */}
      {banForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9000,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ ...card, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14, color: S.danger }}>🚫 Ban {banForm.name}</div>
            <div style={{ fontSize: 12, color: S.textMuted, marginBottom: 8 }}>Reason</div>
            <select style={{ ...input, marginBottom: 10 }} value={banReason} onChange={e => setBanReason(e.target.value)}>
              {banReasons.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <div style={{ fontSize: 12, color: S.textMuted, marginBottom: 8 }}>Duration</div>
            <select style={{ ...input, marginBottom: 16 }} value={banDuration} onChange={e => setBanDuration(e.target.value)}>
              {banDurations.map(d => <option key={d.val} value={d.val}>{d.label}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btn(S.danger)} onClick={async () => {
                const ok = await AS.banPlayer(adminId, banForm.id, banReason, banDuration)
                setBanForm(null); showToast(ok ? `Banned ${banForm.name}` : 'Failed')
                loadPlayers()
              }}>Ban</button>
              <button style={btn('#334155')} onClick={() => setBanForm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Section: Economy ──────────────────────────────────────────────────────────
function EconomySection() {
  const [stats, setStats] = useState(null)
  useEffect(() => { AS.getEconomyStats().then(setStats) }, [])

  return (
    <div>
      <SectionTitle>💰 Economy</SectionTitle>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <StatCard icon="🪙" label="Total Coins"   value={stats?.totalCoins?.toLocaleString()} color="#facc15" />
        <StatCard icon="💎" label="Total Gems"    value={stats?.totalGems?.toLocaleString()}  color="#a78bfa" />
        <StatCard icon="📊" label="Avg per Player" value={stats?.avgCoins}                   color={S.accentLight} />
        <StatCard icon="👥" label="Total Players" value={stats?.playerCount}                 color={S.textMuted} />
      </div>
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: S.textMuted, marginBottom: 12 }}>💰 TOP 10 RICHEST PLAYERS</div>
        <Table
          cols={['Rank', 'Player', 'Coins', 'Gems']}
          rows={(stats?.top10 || []).map((p, i) => ({
            cells: [
              i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`,
              p.id?.slice(-8) || '—',
              `🪙 ${(p.coins||0).toLocaleString()}`,
              `💎 ${p.gems||0}`,
            ],
          }))}
        />
      </div>
    </div>
  )
}

// ── Section: Announcements ────────────────────────────────────────────────────
function AnnouncementsSection({ adminId }) {
  const [list,   setList]   = useState([])
  const [msg,    setMsg]    = useState('')
  const [type,   setType]   = useState('info')
  const [hours,  setHours]  = useState(6)
  const [saving, setSaving] = useState(false)
  const [toast,  setToast]  = useState(null)

  const load = () => AS.getAnnouncements().then(setList)
  useEffect(() => { load() }, [])

  const showToast = (m, ok=true) => { setToast({ m, ok }); setTimeout(() => setToast(null), 2500) }

  const isActive = (a) => {
    if (!a.is_active) return false
    if (a.expires_at && new Date(a.expires_at) < new Date()) return false
    return true
  }

  const typeColors = { info: '#3b82f6', warning: '#f59e0b', celebration: '#7c3aed', error: '#ef4444' }

  return (
    <div>
      <SectionTitle>📢 Announcements</SectionTitle>
      {toast && <div style={{ ...card, background: toast.ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: toast.ok ? S.success : S.danger, marginBottom: 12, fontSize: 13 }}>{toast.m}</div>}

      {/* Create form */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: S.textMuted, marginBottom: 12 }}>NEW ANNOUNCEMENT</div>
        <textarea
          rows={3}
          style={{ ...input, resize: 'vertical', marginBottom: 10 }}
          placeholder="Message shown to all players…"
          value={msg} onChange={e => setMsg(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <select style={{ ...input }} value={type} onChange={e => setType(e.target.value)}>
            {Object.keys(typeColors).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select style={{ ...input }} value={hours} onChange={e => setHours(+e.target.value)}>
            {[[1,'1 hour'],[6,'6 hours'],[24,'24 hours'],[0,'Permanent']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {msg && (
          <div style={{ padding: '8px 12px', borderRadius: 8, background: `${typeColors[type]}22`,
            border: `1px solid ${typeColors[type]}55`, color: typeColors[type], fontSize: 13, marginBottom: 10 }}>
            Preview: {msg}
          </div>
        )}
        <button style={btn()} disabled={saving || !msg.trim()} onClick={async () => {
          setSaving(true)
          const ok = await AS.createAnnouncement(adminId, msg.trim(), type, hours)
          setSaving(false)
          if (ok) { setMsg(''); showToast('Announcement sent!'); load() }
          else showToast('Failed', false)
        }}>
          {saving ? 'Sending…' : '📢 Send Announcement'}
        </button>
      </div>

      {/* List */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, color: S.textMuted, marginBottom: 12 }}>ANNOUNCEMENT HISTORY</div>
        {list.length === 0 ? <div style={{ color: S.textMuted, fontSize: 13 }}>No announcements yet</div>
         : list.map(a => (
            <div key={a.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.05)`, padding: '10px 0',
              display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 10, background: `${typeColors[a.type] ?? typeColors.info}33`,
                    color: typeColors[a.type] ?? typeColors.info, padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>{a.type}</span>
                  <span style={{ fontSize: 10, color: isActive(a) ? S.success : S.textMuted, fontWeight: 700 }}>
                    {isActive(a) ? '🟢 LIVE' : '⚫ inactive'}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: S.text }}>{a.message}</div>
                <div style={{ fontSize: 10, color: S.textMuted, marginTop: 2 }}>
                  {new Date(a.created_at).toLocaleString()}{a.expires_at ? ` · expires ${new Date(a.expires_at).toLocaleString()}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button style={btn(isActive(a) ? '#334155' : S.success, { fontSize: 10 })}
                  onClick={async () => { await AS.toggleAnnouncement(a.id, !a.is_active); load() }}>
                  {a.is_active ? 'Disable' : 'Enable'}
                </button>
                <button style={btn(S.danger, { fontSize: 10 })}
                  onClick={async () => { await AS.deleteAnnouncement(a.id); load() }}>Del</button>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

// ── Section: Settings ─────────────────────────────────────────────────────────
function SettingsSection({ adminId }) {
  const [settings, setSettings] = useState({})
  const [saving,   setSaving]   = useState({})
  const [toast,    setToast]    = useState(null)

  const load = () => AS.getSettings().then(setSettings)
  useEffect(() => { load() }, [])

  const showToast = (m, ok=true) => { setToast({ m, ok }); setTimeout(() => setToast(null), 2500) }

  const toggles = [
    { key: 'maintenance_mode',      label: '🔧 Maintenance Mode',       desc: 'Show maintenance screen to all non-admin players' },
    { key: 'registrations_open',    label: '📝 New Registrations',       desc: 'Allow new player sign-ups' },
    { key: 'chat_enabled',          label: '💬 Global Chat',             desc: 'Enable the global chat system' },
    { key: 'voice_chat_enabled',    label: '🎙 Voice Chat',              desc: 'Enable voice chat between players' },
    { key: 'payments_enabled',      label: '💳 Payments',                desc: 'Enable coin purchase system' },
  ]

  const costFields = [
    { key: 'fast_travel_cost',      label: '📍 Fast Travel Cost (coins)' },
    { key: 'house_travel_cost',     label: '🏠 Home Travel Cost (coins)' },
    { key: 'call_start_cost',       label: '📞 Call Start Cost (coins)' },
    { key: 'npc_extra_message_cost', label: '🤖 NPC Extra Message Cost' },
  ]

  const save = async (key, value) => {
    setSaving(s => ({ ...s, [key]: true }))
    const ok = await AS.setSetting(adminId, key, String(value))
    setSaving(s => ({ ...s, [key]: false }))
    if (ok) { showToast(`${key} updated`); load() }
    else showToast('Failed', false)
  }

  const val = (key) => settings[key]?.value ?? ''
  const isOn = (key, def = true) => {
    const v = val(key)
    return v === '' ? def : (v !== 'false' && v !== '0')
  }

  return (
    <div>
      <SectionTitle>⚙️ Settings</SectionTitle>
      {toast && <div style={{ ...card, background: toast.ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: toast.ok ? S.success : S.danger, marginBottom: 12, fontSize: 13 }}>{toast.m}</div>}

      {/* Toggle switches */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: S.textMuted, marginBottom: 14 }}>FEATURE TOGGLES</div>
        {toggles.map(t => {
          const on = isOn(t.key)
          return (
            <div key={t.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: S.text }}>{t.label}</div>
                <div style={{ fontSize: 11, color: S.textMuted }}>{t.desc}</div>
                {settings[t.key]?.description && <div style={{ fontSize: 10, color: S.textMuted, fontStyle: 'italic' }}>{settings[t.key].description}</div>}
              </div>
              <button
                disabled={saving[t.key]}
                onClick={() => save(t.key, on ? 'false' : 'true')}
                style={{
                  width: 52, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                  background: on ? S.success : '#334155', position: 'relative', transition: 'background 0.2s',
                  flexShrink: 0,
                }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 4, transition: 'left 0.2s',
                  left: on ? 30 : 4,
                }} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Cost fields */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, color: S.textMuted, marginBottom: 14 }}>ECONOMY COSTS</div>
        {costFields.map(f => (
          <div key={f.key} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            <div style={{ flex: 1, fontSize: 13, color: S.text }}>{f.label}</div>
            <input type="number" min={0} defaultValue={val(f.key)} key={val(f.key)}
              style={{ ...input, width: 80, textAlign: 'center' }}
              onBlur={e => { if (+e.target.value !== +val(f.key)) save(f.key, e.target.value) }} />
            {saving[f.key] && <span style={{ fontSize: 11, color: S.accentLight }}>Saving…</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Section: Tournaments ──────────────────────────────────────────────────────
function TournamentsSection({ adminId }) {
  const [list, setList] = useState([])
  const [form, setForm] = useState(false)
  const [gameId, setGameId] = useState('snake')
  const [startsAt, setStartsAt] = useState('')
  const [fee, setFee] = useState(5)
  const [p1, setP1] = useState(500); const [p2, setP2] = useState(200); const [p3, setP3] = useState(100)
  const [toast, setToast] = useState(null)

  const load = () => AS.getAllTournaments().then(setList)
  useEffect(() => { load() }, [])

  const showToast = (m, ok=true) => { setToast({ m, ok }); setTimeout(() => setToast(null), 2500) }

  const statusColor = { upcoming: '#94a3b8', registering: '#f59e0b', active: '#ef4444', completed: '#22c55e' }

  return (
    <div>
      <SectionTitle>🏆 Tournaments</SectionTitle>
      {toast && <div style={{ ...card, background: toast.ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: toast.ok ? S.success : S.danger, marginBottom: 12, fontSize: 13 }}>{toast.m}</div>}

      <button style={{ ...btn(), marginBottom: 16 }} onClick={() => setForm(f => !f)}>
        {form ? '✕ Cancel' : '+ Schedule Tournament'}
      </button>

      {form && (
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: S.textMuted, marginBottom: 12 }}>NEW TOURNAMENT</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <select style={input} value={gameId} onChange={e => setGameId(e.target.value)}>
              {GAME_IDS.map(g => <option key={g} value={g}>{GAME_EMOJIS[g]} {GAME_NAMES[g]}</option>)}
            </select>
            <input type="datetime-local" style={input} value={startsAt} onChange={e => setStartsAt(e.target.value)} />
            <input type="number" style={input} placeholder="Entry fee" value={fee} onChange={e => setFee(+e.target.value)} />
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="number" style={{ ...input, flex: 1 }} placeholder="1st prize" value={p1} onChange={e => setP1(+e.target.value)} />
              <input type="number" style={{ ...input, flex: 1 }} placeholder="2nd" value={p2} onChange={e => setP2(+e.target.value)} />
              <input type="number" style={{ ...input, flex: 1 }} placeholder="3rd" value={p3} onChange={e => setP3(+e.target.value)} />
            </div>
          </div>
          <button style={btn()} onClick={async () => {
            if (!startsAt) return
            const ok = await AS.createTournament(adminId, gameId, new Date(startsAt).toISOString(), fee, p1, p2, p3)
            if (ok) { showToast('Tournament scheduled!'); setForm(false); load() }
            else showToast('Failed', false)
          }}>Create Tournament</button>
        </div>
      )}

      <div style={card}>
        <Table
          cols={['Game', 'Status', 'Start', 'End', 'Participants', 'Actions']}
          rows={list.map(t => ({
            cells: [
              `${GAME_EMOJIS[t.game_id]} ${GAME_NAMES[t.game_id]}`,
              <span style={{ color: statusColor[t.status] ?? S.textMuted, fontWeight: 700 }}>{t.status}</span>,
              new Date(t.starts_at).toLocaleString(),
              new Date(t.ends_at).toLocaleString(),
              (t.participants?.length ?? 0),
              t.status === 'active' ? (
                <button style={btn(S.danger, { fontSize: 10 })} onClick={async () => {
                  await AS.forceTournamentEnd(adminId, t.id); showToast('Tournament ended'); load()
                }}>Force End</button>
              ) : '—',
            ],
          }))}
        />
      </div>
    </div>
  )
}

// ── Section: stub sections ────────────────────────────────────────────────────
function StubSection({ icon, title, bullets }) {
  return (
    <div>
      <SectionTitle>{icon} {title}</SectionTitle>
      <div style={{ ...card, color: S.textMuted, fontSize: 13, lineHeight: 2 }}>
        {bullets.map((b, i) => <div key={i}>• {b}</div>)}
        <div style={{ marginTop: 12, color: S.accentLight, fontSize: 12 }}>Connect to Supabase and implement per your data schema.</div>
      </div>
    </div>
  )
}

// ── Admin Layout ──────────────────────────────────────────────────────────────
const NAV = [
  { id: 'overview',       icon: '📊', label: 'Overview'    },
  { id: 'players',        icon: '👥', label: 'Players'     },
  { id: 'economy',        icon: '💰', label: 'Economy'     },
  { id: 'content',        icon: '📝', label: 'Content'     },
  { id: 'missions',       icon: '🗺️', label: 'Missions'    },
  { id: 'boss',           icon: '💀', label: 'Boss Control' },
  { id: 'tournaments',    icon: '🏆', label: 'Tournaments' },
  { id: 'reports',        icon: '📈', label: 'Reports'     },
  { id: 'announcements',  icon: '📢', label: 'Announcements' },
  { id: 'settings',       icon: '⚙️', label: 'Settings'    },
]

export default function AdminDashboard() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const [section, setSection] = useState('overview')
  const [now,     setNow]     = useState(new Date())
  const [denied,  setDenied]  = useState(false)

  useEffect(() => { const iv = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(iv) }, [])

  // Redirect non-admins after briefly showing the Access Denied screen
  const notAdmin = user && !isAdminUser(user)
  useEffect(() => {
    if (!notAdmin) return
    const t = setTimeout(() => setDenied(true), 1800)
    return () => clearTimeout(t)
  }, [notAdmin])

  // ── Access control ─────────────────────────────────────────────────────────
  if (!user) return <Navigate to="/" />

  if (notAdmin) {
    if (denied) return <Navigate to="/" />
    return (
      <div style={{ ...layoutStyles.root, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 64 }}>🚫</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: S.danger }}>Access Denied</div>
        <div style={{ color: S.textMuted, fontSize: 14 }}>You do not have admin privileges.</div>
        <div style={{ color: S.textMuted, fontSize: 12 }}>Redirecting…</div>
      </div>
    )
  }

  const adminId = user.id

  const renderSection = () => {
    switch (section) {
      case 'overview':      return <OverviewSection      adminId={adminId} />
      case 'players':       return <PlayersSection       adminId={adminId} />
      case 'economy':       return <EconomySection />
      case 'tournaments':   return <TournamentsSection   adminId={adminId} />
      case 'announcements': return <AnnouncementsSection adminId={adminId} />
      case 'settings':      return <SettingsSection      adminId={adminId} />
      case 'content':       return <StubSection icon="📝" title="Content Management" bullets={['NPC management — edit personality prompts, toggle active', 'Shop items — edit prices, toggle visibility', 'Read NPC data from your NPCModel configs and store in a npcs table']} />
      case 'missions':      return <StubSection icon="🗺️" title="Missions" bullets={['List and edit all missions from missionState.js', 'Toggle missions active/inactive', 'View per-player mission progress', 'Manually complete missions for bug reports']} />
      case 'boss':          return <StubSection icon="💀" title="Boss Control" bullets={['Spawn/defeat boss via bossState.js window events', 'Monitor HP percentage and attack count', 'Boss templates: Shadow Vendor, Gossip Ghost, Exam Monster', 'Schedule next boss spawn date/time']} />
      case 'reports':       return <StubSection icon="📈" title="Reports" bullets={['Daily active users, peak hours, retention rates', 'Most visited locations and games', 'Revenue analytics by pack type and day', 'Session duration averages']} />
      default:              return null
    }
  }

  return (
    <div style={layoutStyles.root}>
      {/* Sidebar */}
      <div style={layoutStyles.sidebar}>
        <div style={{ padding: '20px 16px 12px', borderBottom: `1px solid ${S.cardBorder}` }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: S.accentLight }}>🛡 Admin</div>
          <div style={{ fontSize: 11, color: S.textMuted, marginTop: 2 }}>Cartoon Life Universe</div>
        </div>
        <nav style={{ padding: '8px 8px', flex: 1, overflowY: 'auto' }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setSection(n.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: section === n.id ? `${S.accent}33` : 'transparent',
                color: section === n.id ? S.accentLight : S.textMuted,
                fontSize: 13, fontWeight: section === n.id ? 700 : 500,
                fontFamily: 'inherit', marginBottom: 2, textAlign: 'left',
                borderLeft: section === n.id ? `3px solid ${S.accent}` : '3px solid transparent',
              }}>
              <span style={{ fontSize: 16 }}>{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <div style={layoutStyles.topbar}>
          <div style={{ fontWeight: 700, fontSize: 15, color: S.text }}>
            {NAV.find(n => n.id === section)?.icon} {NAV.find(n => n.id === section)?.label}
          </div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: S.textMuted, fontVariantNumeric: 'tabular-nums' }}>
              🕐 {now.toLocaleTimeString()}
            </div>
            <div style={{ fontSize: 12, color: S.accentLight, fontWeight: 600 }}>
              👤 {user.firstName || user.username || 'Admin'}
            </div>
            <button style={btn('#334155')} onClick={() => signOut()}>Sign Out</button>
          </div>
        </div>

        {/* Content */}
        <div style={layoutStyles.content}>
          {renderSection()}
        </div>
      </div>
    </div>
  )
}

const layoutStyles = {
  root:    { display: 'flex', height: '100vh', background: S.bg, color: S.text, fontFamily: 'system-ui, sans-serif', overflow: 'hidden' },
  sidebar: { width: 200, flexShrink: 0, background: S.sidebar, borderRight: `1px solid ${S.cardBorder}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  topbar:  { height: 52, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: `1px solid ${S.cardBorder}`, background: 'rgba(0,0,0,0.3)' },
  content: { flex: 1, overflowY: 'auto', padding: '24px', maxWidth: '100%' },
}
