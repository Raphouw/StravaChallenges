import React, { useState } from 'react';
import { Button, Card } from '../shared/index.js';

interface JoinChallengeModalProps {
  isOpen: boolean;
  jwt: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function JoinChallengeModal({
  isOpen,
  jwt,
  onClose,
  onSuccess,
}: JoinChallengeModalProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('https://strava-challenges-extension.vercel.app/api/challenges/join', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: code.toUpperCase(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        const errorMsg = data.error || 'Failed to join challenge';

        // Translate common error messages to French
        if (errorMsg.includes('already a member') || errorMsg.includes('already exists')) {
          throw new Error('Vous êtes déjà membre de ce challenge');
        }
        if (errorMsg.includes('not found')) {
          throw new Error('Challenge introuvable');
        }
        if (errorMsg.includes('own challenge')) {
          throw new Error('Vous ne pouvez pas rejoindre votre propre challenge');
        }

        throw new Error(errorMsg);
      }

      console.log('Joined challenge');
      setCode('');
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to join challenge:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-80">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Join Challenge</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Challenge Code
            </label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="e.g., ABC123"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-center font-mono text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-orange-500 uppercase"
            />
            <p className="text-xs text-gray-500 mt-2">Enter the 6-letter code shared by the challenge creator</p>
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
              disabled={loading || code.length !== 6}
              className="flex-1"
            >
              {loading ? 'Joining...' : 'Join'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
