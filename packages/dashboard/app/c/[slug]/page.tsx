'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, type LeaderboardEntry, type Challenge } from '@/lib/supabase';
import LeaderboardCard from '@/components/LeaderboardCard';

export default function ChallengePage({
  params,
}: {
  params: { slug: string };
}) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadChallenge() {
      try {
        const { data: challengeData, error: challengeError } = await supabase
          .from('challenges')
          .select('*')
          .eq('id', params.slug)
          .single();

        if (challengeError || !challengeData) {
          setError('Challenge not found');
          setLoading(false);
          return;
        }

        setChallenge(challengeData as Challenge);

        // Fetch leaderboard from API endpoint
        const apiUrl = `https://strava-challenges-extension.vercel.app/api/challenges/leaderboard?id=${params.slug}`;
        const response = await fetch(apiUrl);

        if (response.ok) {
          const data = await response.json();
          setLeaderboard(data);
        }

        setLoading(false);
      } catch (err) {
        console.error('Failed to load challenge:', err);
        setError('Failed to load challenge');
        setLoading(false);
      }
    }

    loadChallenge();

    // Note: Real-time subscriptions would require proper Supabase client setup
    // For now, we rely on the API fetch. In production, you can add WebSocket subscriptions.
  }, [params.slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading challenge...</p>
      </div>
    );
  }

  if (error || !challenge) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <p className="text-red-600 mb-4">{error || 'Challenge not found'}</p>
        <Link href="/" className="text-orange-600 hover:text-orange-700">
          ← Back to challenges
        </Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link href="/" className="text-gray-600 hover:text-gray-900 mb-6 inline-block">
          ← Back to challenges
        </Link>

        <div className="bg-white rounded-lg border border-gray-200 p-8 mb-8">
          <div className="mb-6">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              {challenge.name}
            </h1>
            <div className="flex items-center gap-4 text-gray-600">
              <span className="px-3 py-1 bg-orange-100 text-orange-700 text-sm font-medium rounded">
                {challenge.type} challenge
              </span>
              <span>
                Until {new Date(challenge.ends_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded p-4">
              <p className="text-sm text-gray-600">Participants</p>
              <p className="text-3xl font-bold text-gray-900">
                {leaderboard.length}
              </p>
            </div>
            <div className="bg-gray-50 rounded p-4">
              <p className="text-sm text-gray-600">Status</p>
              <p className="text-lg font-semibold text-gray-900">
                {new Date(challenge.ends_at) > new Date() ? 'Active' : 'Ended'}
              </p>
            </div>
            <div className="bg-gray-50 rounded p-4">
              <p className="text-sm text-gray-600">Invite Code</p>
              <p className="text-lg font-mono font-semibold text-gray-900">
                {challenge.invite_code}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Leaderboard
          </h2>
          <LeaderboardCard
            entries={leaderboard}
            challengeType={challenge.type}
            currentUserId=""
          />
        </div>
      </div>
    </main>
  );
}
