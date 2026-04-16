import React from 'react';
import { Avatar } from './shared/index.js';
import { LeaderboardEntry } from '@/hooks/useLeaderboard.js';

interface LeaderboardCardProps {
  entries: LeaderboardEntry[];
  loading: boolean;
  challengeType: string;
  currentUserId: string;
}

function getScoreLabel(type: string): string {
  switch (type) {
    case 'count':
      return 'Efforts';
    case 'time':
      return 'Minutes';
    case 'elevation':
      return 'Elevation (m)';
    default:
      return 'Score';
  }
}

export function LeaderboardCard({
  entries,
  loading,
  challengeType,
  currentUserId,
}: LeaderboardCardProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-8 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-xs text-gray-500 text-center py-4">No efforts yet</p>
    );
  }

  const topEntries = entries.slice(0, 5);
  const scoreLabel = getScoreLabel(challengeType);

  return (
    <div className="space-y-1">
      {topEntries.map((entry) => {
        const isCurrentUser = entry.user_id === currentUserId;
        return (
          <div
            key={entry.user_id}
            className={`flex items-center gap-2 text-xs p-2 rounded ${
              isCurrentUser ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50'
            }`}
          >
            <span className="font-semibold w-6 text-center text-gray-600">
              #{entry.rank}
            </span>
            <Avatar
              src={entry.user_profile_pic}
              alt={entry.user_name}
              size="sm"
            />
            <span className={`flex-1 truncate ${isCurrentUser ? 'font-semibold text-orange-700' : 'text-gray-900'}`}>
              {entry.user_name}
            </span>
            <span className={`font-semibold whitespace-nowrap ${isCurrentUser ? 'text-orange-600' : 'text-gray-600'}`}>
              {entry.score} {scoreLabel === 'Efforts' ? '' : scoreLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}
