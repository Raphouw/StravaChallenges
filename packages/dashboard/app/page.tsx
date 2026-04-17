'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { Badge } from '@/components/Badge'
import { Avatar } from '@/components/Avatar'
import { EmptyState } from '@/components/EmptyState'

interface Challenge {
  id: string
  slug: string
  name: string
  type: string
  ends_at: string
  invite_code: string
}

function ChallengeGrid() {
  const searchParams = useSearchParams()
  const adminToken = searchParams.get('admin') || ''

  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('https://strava-challenges-dashboard.vercel.app/api/challenges/list-public', {
      cache: 'no-store'
    })
      .then(r => r.json())
      .then(d => {
        setChallenges(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const getChallengeLink = (slug: string) => {
    const baseLink = `/c/${slug}`
    return adminToken ? `${baseLink}?admin=${adminToken}` : baseLink
  }

  const daysRemaining = (endDate: string) => {
    const days = Math.ceil((new Date(endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(0, days)
  }

  const progressPercent = (endDate: string) => {
    const days = daysRemaining(endDate)
    return Math.max(0, Math.min(100, days * 5))
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-slate-800 rounded-lg h-80 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!challenges?.length) {
    return <EmptyState title="No challenges yet" description="Be the first to create one!" />
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {challenges.map((challenge: any) => {
        const days = daysRemaining(challenge.ends_at)
        const progress = progressPercent(challenge.ends_at)
        const isEnded = days <= 0
        const participantCount = challenge.participant_count || 0
        const effortCount = challenge.effort_count || 0

        return (
          <a
            key={challenge.id}
            href={getChallengeLink(challenge.slug)}
            className="group block"
          >
            <div className="bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700/50 rounded-lg overflow-hidden hover:border-orange-500/50 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 h-full flex flex-col">
              {/* Header with gradient */}
              <div className="h-2 bg-gradient-to-r from-orange-500 to-orange-600" />

              <div className="p-4 flex-1 flex flex-col">
                {/* Type badge */}
                <div className="mb-3">
                  <Badge type={challenge.type as any} />
                </div>

                {/* Challenge name */}
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-orange-400 transition-colors">
                  {challenge.name}
                </h3>

                {/* Status and days */}
                <p className="text-xs text-gray-400 mb-3">
                  {isEnded ? 'Challenge ended' : `${days}d left`}
                </p>

                {/* Progress bar */}
                <div className="mb-4 h-1 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      isEnded ? 'bg-gray-600' : 'bg-orange-500'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {/* Segment info */}
                {challenge.segment && (
                  <p className="text-xs text-orange-400 mb-3">
                    🗻 {(challenge.segment.distance / 1000).toFixed(1)}km · {challenge.segment.elevation_gain}m D+
                  </p>
                )}

                {/* Stats from API */}
                <p className="text-xs text-gray-400 mb-4 flex-1">
                  👥 {participantCount} {participantCount === 1 ? 'participant' : 'participants'} · 💪 {effortCount} {effortCount === 1 ? 'effort' : 'efforts'}
                </p>

                {/* Invite code */}
                <div className="mb-4 p-2 bg-slate-900 rounded border border-slate-700 flex items-center justify-between">
                  <code className="text-xs font-mono text-orange-400">{challenge.invite_code}</code>
                  <span className="text-xs text-gray-500">Invite</span>
                </div>

                {/* CTA */}
                <div className="inline-block px-3 py-1.5 bg-orange-600/10 border border-orange-500/30 text-orange-400 text-xs font-medium rounded group-hover:bg-orange-600/20 group-hover:border-orange-500/50 transition-all">
                  View →
                </div>
              </div>
            </div>
          </a>
        )
      })}
    </div>
  )
}

export default function Home() {
  return (
    <div className="min-h-screen bg-black">
      <Navbar />

      {/* Hero Section */}
      <section className="mt-24 px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4">
              Who climbs the most?
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-8">
              Create segment challenges, invite friends, and track every effort in real-time
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap justify-center gap-4 mb-12">
              {[
                { icon: '🔄', text: 'Real-time updates' },
                { icon: '👥', text: 'Group leaderboards' },
                { icon: '⚡', text: 'Auto-tracked' }
              ].map((item, i) => (
                <div
                  key={i}
                  className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-full text-sm text-gray-300 hover:border-orange-500/50 transition-all"
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.text}
                </div>
              ))}
            </div>
          </div>

          {/* Challenges Grid */}
          <Suspense
            fallback={
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-slate-800 rounded-lg h-80 animate-pulse" />
                ))}
              </div>
            }
          >
            <ChallengeGrid />
          </Suspense>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-16 py-8 px-4">
        <div className="max-w-7xl mx-auto text-center text-gray-500 text-sm">
          <p>Made by cyclists, for cyclists. Powered by Strava.</p>
        </div>
      </footer>
    </div>
  )
}
