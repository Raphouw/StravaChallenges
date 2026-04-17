'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { Avatar } from '@/components/Avatar'
import { StatCard } from '@/components/StatCard'
import { InviteCode } from '@/components/InviteCode'

function ChallengeDetail() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params?.slug as string
  const adminToken = searchParams?.get('admin')
  const isAdmin = adminToken === '465786453sd4fsdfsdfsdf456'

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!slug) return
    fetch(
      `https://strava-challenges-extension.vercel.app/api/challenges/public?slug=${slug}`,
      { cache: 'no-store' }
    )
      .then(r => r.json())
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen bg-black pt-20 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-orange-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-400">Loading challenge...</p>
        </div>
      </div>
    )
  }

  if (!data?.name) {
    return (
      <div className="min-h-screen bg-black pt-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-red-400 mb-4">Challenge not found</p>
          <a href="/" className="text-orange-400 hover:text-orange-300 transition">
            ← Back to challenges
          </a>
        </div>
      </div>
    )
  }

  const challenge = data
  const leaderboard = data.leaderboard || []
  const daysRemaining = Math.ceil(
    (new Date(challenge.ends_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  )
  const isEnded = daysRemaining <= 0

  const handleDelete = async () => {
    if (!confirm('Delete this challenge? This cannot be undone.')) return

    setIsDeleting(true)
    try {
      const res = await fetch(
        'https://strava-challenges-extension.vercel.app/api/challenges/delete',
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ challengeId: challenge.id })
        }
      )

      if (res.ok) {
        window.location.href = `/?admin=${adminToken}`
      } else {
        alert('Failed to delete challenge')
      }
    } catch (error) {
      console.error('Delete failed:', error)
      alert('Error deleting challenge')
    } finally {
      setIsDeleting(false)
    }
  }

  const topThree = leaderboard.slice(0, 3)
  const others = leaderboard.slice(3)

  return (
    <div className="min-h-screen bg-black">
      {/* Breadcrumb */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-black/50 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <a
            href={`/?admin=${adminToken || ''}`}
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm"
          >
            ← All Challenges
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-24 pb-12">
        {/* Admin badge */}
        {isAdmin && (
          <div className="mb-4 inline-block px-2 py-1 text-xs font-medium bg-purple-900/50 text-purple-300 border border-purple-700/50 rounded">
            🔐 Admin Mode
          </div>
        )}

        {/* Hero Card */}
        <div className="bg-gradient-to-b from-slate-800/50 to-slate-900 border border-slate-700/50 rounded-xl p-8 mb-8">
          {/* Gradient accent */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl" />

          <div className="relative">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <h1 className="text-5xl font-bold text-white flex-1">{challenge.name}</h1>
              <Badge type={isEnded ? 'ended' : 'active'} />
            </div>

            <p className="text-gray-400 text-lg mb-8">
              {isEnded ? (
                'Challenge ended'
              ) : (
                <>
                  <span className="text-orange-400 font-semibold">{daysRemaining}d</span> remaining
                </>
              )}
            </p>

            <div className="flex flex-wrap gap-4 text-sm text-gray-400 mb-8">
              <div>
                <span className="text-gray-500">Starts:</span> {new Date(challenge.starts_at).toLocaleDateString('en-US')}
              </div>
              <div>
                <span className="text-gray-500">Ends:</span> {new Date(challenge.ends_at).toLocaleDateString('en-US')}
              </div>
              <div>
                <span className="text-gray-500">Type:</span> 
                <span className="text-orange-400 font-semibold ml-1">
                  {challenge.type === 'count' ? '🔢 Count' : challenge.type === 'time' ? '⏱️ Time' : '⬆️ Elevation'}
                </span>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard icon="👥" label="Participants" value={leaderboard.length} />
              <StatCard icon="💪" label="Total Efforts" value={leaderboard.reduce((sum: number, e: any) => sum + e.effort_count, 0)} />
              <StatCard icon="📏" label="Total km" value={Math.round(leaderboard.reduce((sum: number, e: any) => sum + (e.total_distance || 0), 0) * 10) / 10} />
              <StatCard icon="⬆️" label="Total Elevation" value={`${Math.round(leaderboard.reduce((sum: number, e: any) => sum + (e.total_elevation || 0), 0))}m`} />
            </div>

            {/* Segment Card */}
            {challenge.segment && (
              <div className="bg-slate-900/50 border border-orange-500/20 rounded-lg p-4 mb-8">
                <p className="text-xs text-gray-400 mb-2">🗻 Segment</p>
                <a
                  href={`https://www.strava.com/segments/${challenge.segment.strava_segment_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-400 hover:text-orange-300 font-semibold mb-2 inline-block transition"
                >
                  {challenge.segment.name} →
                </a>
                <p className="text-gray-500 text-sm">
                  {(challenge.segment.distance / 1000).toFixed(2)} km · {challenge.segment.elevation_gain}m elevation
                </p>
              </div>
            )}

            {/* Invite Code */}
            <div>
              <p className="text-xs text-gray-400 mb-2">Invite Code</p>
              <InviteCode code={challenge.invite_code} />
            </div>
          </div>
        </div>

        {/* Leaderboard Section */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-6">🏆 Leaderboard</h2>

          {leaderboard.length === 0 ? (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-8 text-center">
              <p className="text-gray-400">No efforts yet. Be the first to complete this segment!</p>
            </div>
          ) : (
            <>
              {/* Top 3 Podium */}
              {topThree.length > 0 && (
                <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {topThree.map((entry: any, idx: number) => {
                    const medals = ['🥇', '🥈', '🥉']
                    const rankColors = ['text-yellow-400', 'text-gray-400', 'text-orange-600']

                    return (
                      <div
                        key={entry.user_id}
                        className={`bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700/50 rounded-lg p-6 text-center ${
                          idx === 0 ? 'md:col-span-1 md:row-span-2 md:self-end' : ''
                        }`}
                      >
                        <div className={`text-4xl mb-3 ${rankColors[idx]}`}>{medals[idx]}</div>
                        <Avatar
                          src={entry.user_profile_pic}
                          name={entry.user_name}
                          size="lg"
                          rank={(idx + 1) as 1 | 2 | 3}
                        />
                        <p className="text-white font-bold mt-4">{entry.user_name}</p>
                        <p className={`text-3xl font-bold mt-2 ${rankColors[idx]}`}>{entry.score}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {challenge.type === 'count' ? 'efforts' : challenge.type === 'time' ? 'minutes' : 'meters'}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Other participants */}
              {others.length > 0 && (
                <div className="space-y-2">
                  {others.map((entry: any, idx: number) => (
                    <div
                      key={entry.user_id}
                      className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 hover:border-orange-500/30 transition-all flex items-center gap-4"
                    >
                      <div className="text-lg font-bold text-gray-500 w-8">#{topThree.length + idx + 1}</div>
                      <Avatar src={entry.user_profile_pic} name={entry.user_name} size="md" />
                      <div className="flex-1">
                        <p className="text-white font-medium">{entry.user_name}</p>
                        <p className="text-xs text-gray-400">
                          Best: {entry.best_time ? `${entry.best_time}s` : '—'} · Attempts: {entry.effort_count}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-orange-400">{entry.score}</p>
                        <p className="text-xs text-gray-400">
                          {challenge.type === 'count' ? 'efforts' : challenge.type === 'time' ? 'min' : 'm'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Coming Soon Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-6 opacity-50 pointer-events-none">
            <p className="text-xs font-semibold text-gray-500 mb-2">⏳ COMING SOON</p>
            <h3 className="text-lg font-bold text-gray-400">Activity Timeline</h3>
            <p className="text-sm text-gray-500 mt-2">Real-time feed of all efforts</p>
          </div>
          <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-6 opacity-50 pointer-events-none">
            <p className="text-xs font-semibold text-gray-500 mb-2">⏳ COMING SOON</p>
            <h3 className="text-lg font-bold text-gray-400">Detailed Analytics</h3>
            <p className="text-sm text-gray-500 mt-2">Your personal stats & charts</p>
          </div>
        </div>

        {/* Admin Delete Button */}
        {isAdmin && (
          <div className="text-center pt-8 border-t border-slate-800">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-900/50 hover:bg-red-900 text-red-400 text-sm font-medium rounded border border-red-800/50 transition-all disabled:opacity-50"
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
        <div className="min-h-screen bg-black pt-20 flex items-center justify-center">
          <p className="text-gray-400">Loading...</p>
        </div>
      }
    >
      <ChallengeDetail />
    </Suspense>
  )
}
