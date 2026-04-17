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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

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
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create challenge')
      }

      setName('')
      setType('count')
      setSegmentId('')
      setStartDate('')
      setEndDate('')
      onSuccess()
      onClose()
    } catch (err) {
      console.error('Failed to create challenge:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="w-96 max-h-96 overflow-y-auto bg-slate-900 border border-slate-700 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">Create Challenge</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Challenge Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-600 bg-slate-800 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="e.g., Monday Morning Climbs"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-600 bg-slate-800 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="count">Count (# of efforts)</option>
              <option value="time">Time (total time)</option>
              <option value="elevation">Elevation (total meters)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Strava Segment ID
            </label>
            <input
              type="number"
              required
              value={segmentId}
              onChange={(e) => setSegmentId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-600 bg-slate-800 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="e.g., 123456"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-600 bg-slate-800 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                End Date
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-600 bg-slate-800 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded transition disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
