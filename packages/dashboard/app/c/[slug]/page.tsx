'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import LeaderboardCard from '@/components/LeaderboardCard';

// Disable caching for real-time leaderboard updates
export const revalidate = 0;

interface Challenge {
  id: string;
  name: string;
  slug: string;
  type: 'count' | 'time' | 'elevation';
  starts_at: string;
  ends_at: string;
  invite_code: string;
}

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  user_name: string;
  user_profile_pic: string;
  effort_count: number;
  total_distance: number;
  total_elevation: number;
  total_moving_time: number;
  score: number;
}

interface PublicChallengeResponse {
  id: string;
  name: string;
  slug: string;
  type: string;
  starts_at: string;
  ends_at: string;
  invite_code: string;
  leaderboard: LeaderboardEntry[];
  segment?: {
    name: string;
    distance: number;
    elevation_gain: number;
    strava_segment_id: number;
  };
}

export default function ChallengePage({
  params,
}: {
  params: { slug: string };
}) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [segment, setSegment] = useState<PublicChallengeResponse['segment']>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadChallenge() {
      try {
        const apiUrl = `https://strava-challenges-extension.vercel.app/api/challenges/public?slug=${params.slug}`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
          setError('Challenge not found');
          setLoading(false);
          return;
        }

        const data: PublicChallengeResponse = await response.json();
        setChallenge({
          id: data.id,
          name: data.name,
          slug: data.slug,
          type: data.type as any,
          starts_at: data.starts_at,
          ends_at: data.ends_at,
          invite_code: data.invite_code,
        });
        setLeaderboard(data.leaderboard);
        setSegment(data.segment);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load challenge:', err);
        setError('Failed to load challenge');
        setLoading(false);
      }
    }

    loadChallenge();
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

  const daysRemaining = Math.ceil(
    (new Date(challenge.ends_at).getTime() - new Date().getTime()) /
      (1000 * 60 * 60 * 24)
  );

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link
          href="/"
          className="text-gray-600 hover:text-gray-900 mb-6 inline-block"
        >
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
                {daysRemaining > 0
                  ? `${daysRemaining}d left`
                  : 'Challenge ended'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 rounded p-4">
              <p className="text-sm text-gray-600">Participants</p>
              <p className="text-3xl font-bold text-gray-900">
                {leaderboard.length}
              </p>
            </div>
            <div className="bg-gray-50 rounded p-4">
              <p className="text-sm text-gray-600">Status</p>
              <p className="text-lg font-semibold text-gray-900">
                {daysRemaining > 0 ? 'Active' : 'Ended'}
              </p>
            </div>
            <div className="bg-gray-50 rounded p-4">
              <p className="text-sm text-gray-600">Invite Code</p>
              <p className="text-lg font-mono font-semibold text-gray-900">
                {challenge.invite_code}
              </p>
            </div>
          </div>

          {segment && (
            <div className="bg-orange-50 border border-orange-200 rounded p-4">
              <a
                href={`https://www.strava.com/segments/${segment.strava_segment_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-80 transition"
              >
                <p className="text-xs font-semibold text-gray-700 mb-1">
                  Segment
                </p>
                <p className="text-lg font-semibold text-orange-700 hover:underline">
                  {segment.name}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {(segment.distance / 1000).toFixed(1)} km •{' '}
                  {segment.elevation_gain}m D+
                </p>
              </a>
            </div>
          )}
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
