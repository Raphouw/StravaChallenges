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

function formatTime(seconds: number): string {
  if (seconds === 0) return '-';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getRelativeTime(dateStr: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1d ago';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}m ago`;
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
          <div key={i} className="h-10 bg-gray-200 rounded animate-pulse" />
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
    <div className="space-y-2">
      {topEntries.map((entry) => {
        const isCurrentUser = entry.user_id === currentUserId;
        return (
          <div
            key={entry.user_id}
            className={`flex items-center gap-2 text-xs p-2 rounded ${
              isCurrentUser ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50'
            }`}
          >
            <span className="font-semibold w-5 text-center text-gray-600">
              #{entry.rank}
            </span>
            <Avatar
              src={entry.user_profile_pic}
              alt={entry.user_name}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <span className={`block truncate ${isCurrentUser ? 'font-semibold text-orange-700' : 'text-gray-900'}`}>
                {entry.user_name}
              </span>
              <span className="text-gray-500 text-xs">
                {entry.streak > 0 && `🔥 ${entry.streak}d • `}
                {getRelativeTime(entry.last_attempt)}
              </span>
            </div>
            <div className="text-right">
              <span className={`font-semibold whitespace-nowrap block ${isCurrentUser ? 'text-orange-600' : 'text-gray-600'}`}>
                {entry.score} {scoreLabel === 'Efforts' ? '' : scoreLabel}
              </span>
              <span className={`text-xs ${isCurrentUser ? 'text-orange-500' : 'text-gray-500'}`}>
                {entry.delta_from_leader}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
