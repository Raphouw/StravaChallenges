'use client'

import { useState } from 'react'

interface CreateChallengeModalProps {
  isOpen: boolean
  jwt: string
  onClose: () => void
  onSuccess: () => void
}

export function CreateChallengeModal({
  isOpen,
  jwt,
  onClose,
  onSuccess,
}: CreateChallengeModalProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'count' | 'time' | 'elevation'>('count')
  const [segmentId, setSegmentId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  if (!isOpen) return null

  if (inviteCode) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="w-full max-w-md bg-[#12121a] border border-white/10 rounded-2xl p-8 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h3 className="text-2xl font-bold text-white mb-2">Challenge Created!</h3>
          <p className="text-slate-400 text-sm mb-6">Share the invite code with your friends</p>
          <div className="bg-[#0a0a0f] border border-orange-500/30 rounded-xl p-4 mb-6">
            <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Invite Code</p>
            <p className="text-3xl font-bold font-mono text-orange-400 tracking-widest">{inviteCode}</p>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(inviteCode)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
            className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl transition mb-3"
          >
            {copied ? '✓ Copied!' : '📋 Copy Code'}
          </button>
          <button
            onClick={() => {
              setInviteCode(null)
              setName('')
              setType('count')
              setSegmentId('')
              setStartDate('')
              setEndDate('')
              setIsPublic(true)
              setError(null)
              onSuccess()
              onClose()
            }}
            className="w-full py-3 bg-white/5 hover:bg-white/10 text-slate-300 font-medium rounded-xl transition"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (start > end) {
      setError('End date must be after start date')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('https://strava-challenges-extension.vercel.app/api/challenges/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          type,
          segment_id: parseInt(segmentId, 10),
          starts_at: new Date(startDate).toISOString(),
          ends_at: new Date(endDate).toISOString(),
          is_public: isPublic,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create challenge')
      }

      const data = await response.json()

      // If challenge started in the past, trigger backfill on client side
      if (data.needs_backfill) {
        setError('Importing past efforts...')
        try {
          await fetch('https://strava-challenges-extension.vercel.app/api/challenges/backfill', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${jwt}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ challengeId: data.id }),
          })
        } catch (err) {
          console.error('Backfill failed:', err)
        }
        setError(null)
      }

      setInviteCode(data.invite_code)
    } catch (err) {
      console.error('Failed to create challenge:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div
        className="w-full flex flex-col bg-[#12121a] border border-white/10 rounded-2xl overflow-hidden"
        style={{ maxWidth: 'min(640px, 95vw)', maxHeight: '85vh' }}
      >
        {/* Sticky header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-white/10 flex-shrink-0">
          <h3 className="text-lg font-bold text-white">Create Challenge</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="p-3 bg-red-900/20 border border-red-700/40 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Challenge Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2.5 border border-white/10 bg-[#0a0a0f] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition"
              placeholder="e.g., Monday Morning Climbs"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Challenge Type</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'count', label: '🔢 Count', desc: 'Most efforts' },
                { value: 'time', label: '⏱️ Time', desc: 'Most minutes' },
                { value: 'elevation', label: '⛰️ Elevation', desc: 'Most meters' },
              ] as const).map(({ value, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  className={`p-3 rounded-xl border text-left transition ${
                    type === value
                      ? 'border-orange-500/60 bg-orange-500/10 text-white'
                      : 'border-white/10 bg-white/[3%] text-slate-400 hover:border-white/[15%]'
                  }`}
                >
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Strava Segment ID</label>
            <input
              type="number"
              required
              value={segmentId}
              onChange={(e) => setSegmentId(e.target.value)}
              className="w-full px-3 py-2.5 border border-white/10 bg-[#0a0a0f] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition"
              placeholder="e.g., 12345678"
            />
            <p className="text-xs text-slate-500 mt-1.5">
              Find the ID in the Strava URL: strava.com/segments/<span className="text-orange-400 font-mono">[ID]</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Start Date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-white/10 bg-[#0a0a0f] rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition [color-scheme:dark]"
              />
              <p className="text-xs text-slate-500 mt-1">Can be in the past — efforts will be backfilled</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">End Date</label>
              <input
                type="date"
                required
                value={endDate}
                min={today}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-white/10 bg-[#0a0a0f] rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Visibility toggle */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Visibility</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={`p-3 rounded-xl border text-left transition ${
                  isPublic
                    ? 'border-orange-500/60 bg-orange-500/10 text-white'
                    : 'border-white/10 bg-white/[3%] text-slate-400 hover:border-white/[15%]'
                }`}
              >
                <div className="text-sm font-medium">🌍 Public</div>
                <div className="text-xs text-slate-500 mt-0.5">Visible & joinable by all</div>
              </button>
              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={`p-3 rounded-xl border text-left transition ${
                  !isPublic
                    ? 'border-orange-500/60 bg-orange-500/10 text-white'
                    : 'border-white/10 bg-white/[3%] text-slate-400 hover:border-white/[15%]'
                }`}
              >
                <div className="text-sm font-medium">🔒 Private</div>
                <div className="text-xs text-slate-500 mt-0.5">Invite code required</div>
              </button>
            </div>
          </div>
        </div>

        {/* Sticky footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-white/10 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-medium rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-challenge-form"
            disabled={loading}
            className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50"
            onClick={handleSubmit}
          >
            {loading ? 'Creating...' : 'Create Challenge'}
          </button>
        </div>
      </div>
    </div>
  )
}
