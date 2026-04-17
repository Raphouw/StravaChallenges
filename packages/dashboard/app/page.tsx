'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { CreateChallengeModal } from '@/components/CreateChallengeModal'
import { useAuth } from '@/hooks/useAuth'

const API = 'https://strava-challenges-extension.vercel.app'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; color: string }> = {
    count: { label: 'COUNT', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
    time: { label: 'TIME', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
    elevation: { label: 'ELEVATION', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
    distance: { label: 'DISTANCE', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  }
  const { label, color } = map[type] || { label: type.toUpperCase(), color: 'bg-slate-500/15 text-slate-400 border-slate-500/30' }
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border tracking-wider ${color}`}>{label}</span>
  )
}

function ChallengeCard({ challenge, token, adminToken, onJoin }: {
  challenge: any
  token: string | null
  adminToken: string
  onJoin: (id: string) => void
}) {
  const [joining, setJoining] = useState(false)
  const [copied, setCopied] = useState(false)

  const now = Date.now()
  const start = new Date(challenge.starts_at).getTime()
  const end = new Date(challenge.ends_at).getTime()
  const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24))
  const isEnded = daysLeft <= 0
  const progress = Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100))

  const handleJoin = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!token) return
    setJoining(true)
    try {
      const body: any = challenge.is_public
        ? { challenge_id: challenge.id }
        : { code: challenge.invite_code }

      const res = await fetch(`${API}/api/challenges/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) onJoin(challenge.id)
      else alert('Failed to join challenge')
    } finally {
      setJoining(false)
    }
  }

  const slug = challenge.slug
  const link = adminToken ? `/c/${slug}?admin=${adminToken}` : `/c/${slug}`

  return (
    <a href={link} className="group block">
      <div
        className="relative flex flex-col h-full rounded-xl border transition-all duration-200 overflow-hidden"
        style={{
          background: '#12121a',
          borderColor: 'rgba(255,255,255,0.08)',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(251,146,60,0.4)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
      >
        {/* Orange top border */}
        <div className="h-1 w-full bg-gradient-to-r from-orange-500 to-orange-400 flex-shrink-0" />

        <div className="p-5 flex flex-col flex-1">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <TypeBadge type={challenge.type} />
              {!challenge.is_public && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-slate-700/50 text-slate-400 border-slate-600/50 tracking-wider">
                  🔒 PRIVATE
                </span>
              )}
            </div>
            <span className={`text-xs font-medium flex-shrink-0 ${isEnded ? 'text-slate-500' : 'text-orange-400'}`}>
              {isEnded ? 'Ended' : `${daysLeft}d left`}
            </span>
          </div>

          {/* Name */}
          <h3 className="text-base font-bold text-white group-hover:text-orange-400 transition-colors mb-2 leading-tight">
            {challenge.name}
          </h3>

          {/* Progress bar */}
          <div className="h-1 bg-white/5 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isEnded ? 'bg-slate-600' : 'bg-orange-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Dates */}
          <p className="text-xs text-slate-500 mb-3">
            📅 {formatDate(challenge.starts_at)} → {formatDate(challenge.ends_at)}
          </p>

          {/* Segment */}
          {challenge.segment && (
            <div className="mb-3">
              <p className="text-xs text-slate-300 font-medium">🏔️ {challenge.segment.segment_name || 'Segment'}</p>
              <p className="text-xs text-slate-500">
                {challenge.segment.distance ? `${(challenge.segment.distance / 1000).toFixed(1)} km` : '—'}
                {challenge.segment.elevation_gain ? ` · ${Math.round(challenge.segment.elevation_gain)}m D+` : ''}
              </p>
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-white/[3%] rounded-lg p-2 border border-white/[6%]">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Participants</p>
              <p className="text-sm font-bold text-white">👥 {challenge.participant_count || 0}</p>
            </div>
            <div className="bg-white/[3%] rounded-lg p-2 border border-white/[6%]">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Efforts</p>
              <p className="text-sm font-bold text-white">💪 {challenge.effort_count || 0}</p>
            </div>
          </div>

          {/* Invite code */}
          <div
            className="flex items-center justify-between bg-black/30 border border-white/[6%] rounded-lg px-3 py-2 mb-4"
            onClick={(e) => e.preventDefault()}
          >
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Invite Code</p>
              <code className="text-sm font-mono font-bold text-orange-400">{challenge.invite_code}</code>
            </div>
            <button
              className="text-xs text-slate-400 hover:text-white transition px-2 py-1 rounded hover:bg-white/10"
              onClick={(e) => {
                e.preventDefault()
                navigator.clipboard.writeText(challenge.invite_code)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
            >
              {copied ? '✓' : '📋'}
            </button>
          </div>

          {/* CTA buttons */}
          <div className="mt-auto flex gap-2">
            <span className="flex-1 inline-block px-3 py-2 text-center text-xs font-medium text-orange-400 border border-orange-500/30 rounded-lg bg-orange-500/[5%] group-hover:bg-orange-500/15 transition">
              View leaderboard →
            </span>
            {token && (
              <button
                onClick={handleJoin}
                disabled={joining}
                className="px-3 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition disabled:opacity-50 flex-shrink-0"
              >
                {joining ? '…' : 'Join'}
              </button>
            )}
          </div>
        </div>
      </div>
    </a>
  )
}

function ChallengeGrid({ onCreateSuccess }: { onCreateSuccess: () => void }) {
  const searchParams = useSearchParams()
  const adminToken = searchParams.get('admin') || ''
  const { token } = useAuth()

  const [challenges, setChallenges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchChallenges = () => {
    setLoading(true)
    fetch(`${API}/api/challenges/list?scope=public`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setChallenges(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { fetchChallenges() }, [])

  const handleJoin = (id: string) => {
    fetchChallenges()
    onCreateSuccess()
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl border border-white/[6%] bg-[#12121a] h-80 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!challenges.length) {
    return (
      <div className="text-center py-20">
        <p className="text-4xl mb-4">🏔️</p>
        <p className="text-white font-semibold text-lg mb-2">No challenges yet</p>
        <p className="text-slate-500 text-sm">Be the first to create one!</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {challenges.map((c) => (
        <ChallengeCard
          key={c.id}
          challenge={c}
          token={token}
          adminToken={adminToken}
          onJoin={handleJoin}
        />
      ))}
    </div>
  )
}

export default function Home() {
  const { token } = useAuth()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0f' }}>
      <Navbar />

      {/* Hero */}
      <section className="mt-16 px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4 tracking-tight">
              Who climbs the most?
            </h1>
            <p className="text-slate-400 text-lg max-w-xl mx-auto mb-8">
              Create segment challenges, invite friends, track every effort in real-time.
            </p>
            {token && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl transition text-sm"
              >
                + Create Challenge
              </button>
            )}
          </div>

          <Suspense
            fallback={
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="rounded-xl border border-white/[6%] bg-[#12121a] h-80 animate-pulse" />
                ))}
              </div>
            }
          >
            <ChallengeGrid key={refreshKey} onCreateSuccess={() => setRefreshKey(p => p + 1)} />
          </Suspense>
        </div>
      </section>

      <footer className="border-t border-white/5 mt-16 py-8 px-4 text-center text-slate-600 text-xs">
        Made by cyclists, for cyclists. Powered by Strava.
      </footer>

      {token && (
        <CreateChallengeModal
          isOpen={showCreateModal}
          jwt={token}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setRefreshKey(p => p + 1)
            setShowCreateModal(false)
          }}
        />
      )}
    </div>
  )
}
