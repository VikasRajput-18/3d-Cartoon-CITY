// Shows active game_announcements from Supabase as dismissible banners in the game.
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const TYPE_STYLE = {
  info:        { bg: 'rgba(59,130,246,0.18)',  border: 'rgba(59,130,246,0.4)',  color: '#93c5fd', icon: 'ℹ️' },
  warning:     { bg: 'rgba(245,158,11,0.18)',  border: 'rgba(245,158,11,0.4)',  color: '#fde68a', icon: '⚠️' },
  celebration: { bg: 'rgba(124,58,237,0.18)', border: 'rgba(124,58,237,0.4)', color: '#c4b5fd', icon: '🎉' },
  error:       { bg: 'rgba(239,68,68,0.18)',  border: 'rgba(239,68,68,0.4)',  color: '#fca5a5', icon: '🚨' },
}

function isExpired(expiresAt) {
  if (!expiresAt) return false
  return new Date(expiresAt) < new Date()
}

export default function GameAnnouncementBanner() {
  const [banners, setBanners]       = useState([])
  const [dismissed, setDismissed]   = useState(new Set())

  const fetchBanners = async () => {
    if (!supabase) return
    try {
      const { data } = await supabase
        .from('game_announcements')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(5)
      if (data) setBanners(data.filter(b => !isExpired(b.expires_at)))
    } catch {}
  }

  useEffect(() => {
    fetchBanners()
    if (!supabase) return
    const chan = supabase.channel('ann_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_announcements' }, fetchBanners)
      .subscribe()
    const iv = setInterval(fetchBanners, 60000)
    return () => { chan.unsubscribe(); clearInterval(iv) }
  }, [])

  const visible = banners.filter(b => !dismissed.has(b.id))
  if (!visible.length) return null

  return (
    <div className="fixed top-[52px] left-1/2 -translate-x-1/2 z-[350] flex flex-col gap-1 w-full max-w-[520px] px-3 pointer-events-none">
      {visible.map(b => {
        const s = TYPE_STYLE[b.type] ?? TYPE_STYLE.info
        return (
          <div
            key={b.id}
            className="flex items-start gap-2 rounded-xl font-body pointer-events-auto"
            style={{
              background: s.bg, border: `1px solid ${s.border}`,
              padding: '9px 12px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              animation: 'slideDown 0.3s ease',
            }}
          >
            <span className="text-base shrink-0 mt-[1px]">{s.icon}</span>
            <span className="flex-1 text-[13px] font-semibold leading-[1.4]" style={{ color: s.color }}>
              {b.message}
            </span>
            <button
              onClick={() => setDismissed(prev => new Set([...prev, b.id]))}
              className="shrink-0 bg-transparent border-0 cursor-pointer text-[16px] leading-none opacity-50 hover:opacity-100"
              style={{ color: s.color }}
            >×</button>
          </div>
        )
      })}
      <style>{`@keyframes slideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}
