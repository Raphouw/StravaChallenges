import React, { useState } from 'react';
import { Button, Card } from '../shared/index.js';
import { SuccessModal } from './SuccessModal.js';

interface CreateChallengeModalProps {
  isOpen: boolean;
  jwt: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateChallengeModal({
  isOpen,
  jwt,
  onClose,
  onSuccess,
}: CreateChallengeModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'count' | 'time' | 'elevation'>('count');
  const [segmentId, setSegmentId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  const handleSuccessClose = () => {
    setShowSuccess(false);
    setName('');
    setType('count');
    setSegmentId('');
    setStartDate('');
    setEndDate('');
    setError(null);
    onSuccess();
    onClose();
  };

  if (!isOpen) return null;

  if (showSuccess) {
    return (
      <SuccessModal
        isOpen={showSuccess}
        title="Challenge Created!"
        message="Your challenge has been created successfully. Share the code with your friends!"
        code={inviteCode}
        onClose={handleSuccessClose}
      />
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      setError('End date must be after start date');
      setLoading(false);
      return;
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
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create challenge');
      }

      const data = await response.json();
      console.log('Challenge created:', data);

      // If challenge started in the past, trigger backfill on client side
      if (data.needs_backfill) {
        setError('Importing past efforts...');
        try {
          await fetch('https://strava-challenges-extension.vercel.app/api/challenges/backfill', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${jwt}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ challengeId: data.id }),
          });
        } catch (err) {
          console.warn('[modal] backfill failed, continuing anyway:', err);
        }
        setError(null);
      }

      setInviteCode(data.invite_code);
      setShowSuccess(true);
    } catch (err) {
      console.error('Failed to create challenge:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
      return;
    }

    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="w-96 max-h-96 overflow-y-auto bg-slate-900 border border-slate-700 rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">Create Challenge</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
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
            <label className="block text-sm font-medium text-slate-200 mb-1">
              Challenge Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-600 bg-slate-800 rounded-md text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="e.g., Monday Morning Climbs"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">
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
            <label className="block text-sm font-medium text-slate-200 mb-1">
              Strava Segment ID
            </label>
            <input
              type="number"
              required
              value={segmentId}
              onChange={(e) => setSegmentId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-600 bg-slate-800 rounded-md text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="e.g., 123456"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">
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
              <label className="block text-sm font-medium text-slate-200 mb-1">
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
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
