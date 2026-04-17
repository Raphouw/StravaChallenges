'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

const API = 'https://strava-challenges-extension.vercel.app'

function formatTime(seconds: number): string {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; color: string }> = {
    count: { label: '🔢 COUNT', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
    time: { label: '⏱️ TIME', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
    elevation: { label: '⛰️ ELEVATION', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
    distance: { label: '📏 DISTANCE', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  }
  const { label, color } = map[type] || { label: type.toUpperCase(), color: 'bg-slate-500/15 text-slate-400 border-slate-500/30' }
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border tracking-wider ${color}`}>{label}</span>
  )
}

function StatBox({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 p-4" style={{ background: '#1a1a28' }}>
      <p className="text-xl mb-1">{icon}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  )
}

function Avatar({ src, name, size = 'md' }: { src?: string; name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-base' }
  if (src) {
    return <img src={src} alt={name} className={`${sizes[size]} rounded-full object-cover border border-white/10`} />
  }
  return (
    <div className={`${sizes[size]} rounded-full bg-orange-600/20 border border-orange-500/30 flex items-center justify-center font-bold text-orange-400`}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function ChallengeDetail() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params?.slug as string
  const adminToken = searchParams?.get('admin')
  const isAdmin = adminToken === '465786453sd4fsdfsdfsdf456'

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!slug) return
    fetch(`${API}/api/challenges/public?slug=${slug}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0f' }}>
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-slate-400">Loading challenge...</p>
        </div>
      </div>
    )
  }

  if (!data?.name) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0f' }}>
        <div className="text-center">
          <p className="text-red-400 mb-4">Challenge not found</p>
          <a href="/" className="text-orange-400 hover:text-orange-300 transition text-sm">← Back to challenges</a>
        </div>
      </div>
    )
  }

  const challenge = data
  const leaderboard: any[] = data.leaderboard || []

  const now = Date.now()
  const endTs = new Date(challenge.ends_at).getTime()
  const daysRemaining = Math.ceil((endTs - now) / (1000 * 60 * 60 * 24))
  const isEnded = daysRemaining <= 0

  const sortedLeaderboard = [...leaderboard].sort((a, b) => {
    if (challenge.type === 'time') return (a.best_time || Infinity) - (b.best_time || Infinity)
    if (challenge.type === 'elevation') return b.total_elevation - a.total_elevation
    if (challenge.type === 'distance') return b.total_distance - a.total_distance
    return b.effort_count - a.effort_count
  }).map((e, i) => ({ ...e, rank: i + 1 }))

  const totalEfforts = leaderboard.reduce((s, e) => s + (e.effort_count || 0), 0)
  const totalKm = leaderboard.reduce((s, e) => s + (e.total_distance || 0), 0)
  const totalElevation = leaderboard.reduce((s, e) => s + (e.total_elevation || 0), 0)

  const handleDelete = async () => {
    if (!confirm('Delete this challenge? This cannot be undone.')) return
    setIsDeleting(true)
    try {
      const res = await fetch(`${API}/api/challenges/delete`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: challenge.id }),
      })
      if (res.ok) window.location.href = adminToken ? `/?admin=${adminToken}` : '/'
      else alert('Failed to delete challenge')
    } catch { alert('Error deleting challenge') }
    finally { setIsDeleting(false) }
  }

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0f' }}>
      {/* Top nav bar */}
      <div className="fixed top-0 left-0 right-0 z-40 border-b border-white/[6%]" style={{ background: 'rgba(10,10,15,0.9)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href={adminToken ? `/?admin=${adminToken}` : '/'} className="text-slate-400 hover:text-white transition flex items-center gap-1.5 text-sm">
            ← All Challenges
          </a>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${isEnded ? 'bg-slate-700/50 text-slate-400 border-slate-600/50' : 'bg-green-500/15 text-green-400 border-green-500/30'}`}>
            {isEnded ? '⬛ ENDED' : '🟢 ACTIVE'}
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-20 pb-16">
        {/* Hero section */}
        <div className="mb-8">
          {isAdmin && (
            <div className="mb-4 inline-block px-3 py-1 text-xs font-medium bg-purple-900/30 text-purple-300 border border-purple-700/40 rounded-lg">
              🔐 Admin Mode
            </div>
          )}

          <div className="flex flex-wrap items-start gap-3 mb-3">
            <TypeBadge type={challenge.type} />
            {challenge.is_public === false && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg border bg-slate-700/50 text-slate-400 border-slate-600/50 tracking-wider">🔒 PRIVATE</span>
            )}
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3 leading-tight">{challenge.name}</h1>
          <p className="text-slate-400 mb-2">
            {isEnded ? 'Challenge ended' : (
              <span><span className="text-orange-400 font-semibold">{daysRemaining} day{daysRemaining !== 1 ? 's' : ''}</span> remaining</span>
            )}
          </p>
          <p className="text-sm text-slate-500">{formatDate(challenge.starts_at)} → {formatDate(challenge.ends_at)}</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatBox icon="👥" label="Participants" value={leaderboard.length} />
          <StatBox icon="💪" label="Total Efforts" value={totalEfforts} />
          <StatBox icon="📏" label="Total km" value={`${Math.round(totalKm * 10) / 10} km`} />
          <StatBox icon="⛰️" label="Total D+" value={`${Math.round(totalElevation).toLocaleString()} m`} />
        </div>

        {/* Info row: segment + invite code */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {challenge.segment && (
            <div className="rounded-xl border border-white/10 p-5" style={{ background: '#12121a' }}>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">🏔️ Segment</p>
              <a
                href={`https://www.strava.com/segments/${challenge.segment.strava_segment_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-400 hover:text-orange-300 font-semibold text-lg block mb-2 transition"
              >
                {challenge.segment.name} →
              </a>
              <p className="text-slate-400 text-sm">
                {challenge.segment.distance ? `${(challenge.segment.distance / 1000).toFixed(1)} km` : '—'}
                {challenge.segment.elevation_gain ? ` · ${Math.round(challenge.segment.elevation_gain)}m D+` : ''}
              </p>
            </div>
          )}

          <div className="rounded-xl border border-white/10 p-5" style={{ background: '#12121a' }}>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">🔑 Invite Code</p>
            <div className="flex items-center gap-3 mb-3">
              <code className="text-3xl font-mono font-bold text-orange-400 tracking-widest">{challenge.invite_code}</code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(challenge.invite_code)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                className="px-3 py-1.5 text-xs bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded-lg hover:bg-orange-500/20 transition"
              >
                {copied ? '✓ Copied' : '📋 Copy'}
              </button>
            </div>
            {challenge.is_public === false && (
              <p className="text-xs text-slate-500">🔒 Private — share the code to invite friends</p>
            )}
            {challenge.is_public !== false && (
              <p className="text-xs text-slate-500">🌍 Public — anyone can view and join</p>
            )}
          </div>
        </div>

        {/* Leaderboard */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-5">🏆 Leaderboard</h2>

          {sortedLeaderboard.length === 0 ? (
            <div className="rounded-xl border border-white/10 p-12 text-center" style={{ background: '#12121a' }}>
              <p className="text-4xl mb-3">⏳</p>
              <p className="text-slate-400">No efforts yet. Be the first to complete this segment!</p>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 overflow-hidden" style={{ background: '#12121a' }}>
              {/* Table header */}
              <div className="grid grid-cols-[40px_1fr_80px_90px_80px_70px_70px_100px] gap-2 px-4 py-3 border-b border-white/[6%] text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                <span>#</span>
                <span>Athlete</span>
                <span className="text-right">Efforts</span>
                <span className="text-right">Best Time</span>
                <span className="text-right">Avg Time</span>
                <span className="text-right">km</span>
                <span className="text-right">D+</span>
                <span className="text-right">Last Attempt</span>
              </div>

              {sortedLeaderboard.map((entry, idx) => {
                const isFirst = idx === 0
                return (
                  <div
                    key={entry.user_id}
                    className={`grid grid-cols-[40px_1fr_80px_90px_80px_70px_70px_100px] gap-2 px-4 py-3.5 border-b border-white/[4%] last:border-0 transition-colors ${isFirst ? 'bg-orange-500/[5%] hover:bg-orange-500/[8%]' : 'hover:bg-white/[3%]'}`}
                  >
                    <div className="flex items-center">
                      {idx === 0 ? <span className="text-lg">🥇</span> : idx === 1 ? <span className="text-lg">🥈</span> : idx === 2 ? <span className="text-lg">🥉</span> : (
                        <span className="text-sm font-bold text-slate-500">#{idx + 1}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar src={entry.user_profile_pic} name={entry.user_name} size="sm" />
                      <span className={`text-sm font-medium truncate ${isFirst ? 'text-white' : 'text-slate-300'}`}>{entry.user_name}</span>
                    </div>
                    <div className="flex items-center justify-end">
                      <span className="text-sm text-slate-300">{entry.effort_count}</span>
                    </div>
                    <div className="flex items-center justify-end">
                      <span className="text-xs text-slate-300 font-mono">{formatTime(entry.best_time)}</span>
                    </div>
                    <div className="flex items-center justify-end">
                      <span className="text-xs text-slate-400 font-mono">{formatTime(entry.avg_time)}</span>
                    </div>
                    <div className="flex items-center justify-end">
                      <span className="text-xs text-slate-300">{typeof entry.total_distance === 'number' ? `${entry.total_distance.toFixed(1)}` : '—'}</span>
                    </div>
                    <div className="flex items-center justify-end">
                      <span className="text-xs text-slate-300">{entry.total_elevation ? `${Math.round(entry.total_elevation)}m` : '—'}</span>
                    </div>
                    <div className="flex items-center justify-end">
                      <span className="text-xs text-slate-500">
                        {entry.last_attempt ? new Date(entry.last_attempt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Admin delete */}
        {isAdmin && (
          <div className="text-center pt-10 border-t border-white/5 mt-10">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-5 py-2.5 bg-red-900/20 hover:bg-red-900/40 text-red-400 text-sm font-medium rounded-xl border border-red-800/40 transition disabled:opacity-50"
            >
              {isDeleting ? '🗑️ Deleting...' : '🗑️ Delete Challenge'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0f' }}>
          <p className="text-slate-400">Loading...</p>
        </div>
      }
    >
      <ChallengeDetail />
    </Suspense>
  )
}
