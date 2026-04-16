'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface Challenge {
  id: string;
  slug: string;
  name: string;
  type: string;
  ends_at: string;
}

function ChallengeListWithParams() {
  const searchParams = useSearchParams();
  const adminToken = searchParams.get('admin') || '';

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadChallenges() {
      try {
        const response = await fetch(
          'https://strava-challenges-extension.vercel.app/api/challenges/list-public',
          { cache: 'no-store' }
        );
        if (response.ok) {
          const data = await response.json();
          setChallenges(data);
        }
      } catch (error) {
        console.error('Failed to fetch challenges:', error);
      } finally {
        setLoading(false);
      }
    }

    loadChallenges();
  }, []);

  const getChallengeLink = (slug: string) => {
    const baseLink = `/c/${slug}`;
    return adminToken ? `${baseLink}?admin=${adminToken}` : baseLink;
  };

  return (
    <div className="grid gap-4">
      {!loading && challenges && challenges.length > 0 ? (
        challenges.map((challenge) => (
          <Link
            key={challenge.id}
            href={getChallengeLink(challenge.slug)}
            className="block"
          >
            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:border-orange-500 hover:shadow-lg transition">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">
                    {challenge.name}
                  </h2>
                  <p className="text-gray-600 mt-1">
                    {challenge.type} challenge
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">
                    Ends {new Date(challenge.ends_at).toLocaleDateString()}
                  </p>
                  <div className="mt-2 inline-block px-3 py-1 bg-orange-100 text-orange-700 text-sm font-medium rounded">
                    View →
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))
      ) : (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">
            {loading ? 'Loading challenges...' : 'No challenges yet'}
          </p>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-2">
            Strava Challenges
          </h1>
          <p className="text-xl text-gray-600">
            View leaderboards and compete with others
          </p>
        </div>

        <Suspense
          fallback={
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <p className="text-gray-500">Loading challenges...</p>
            </div>
          }
        >
          <ChallengeListWithParams />
        </Suspense>
      </div>
    </main>
  );
}
