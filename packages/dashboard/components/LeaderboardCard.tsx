import Image from 'next/image';
import { LeaderboardEntry } from '@/lib/supabase';

interface LeaderboardCardProps {
  entries: LeaderboardEntry[];
  challengeType: string;
  currentUserId: string;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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

export default function LeaderboardCard({
  entries,
  challengeType,
  currentUserId,
}: LeaderboardCardProps) {
  if (entries.length === 0) {
    return (
      <p className="text-gray-500 text-center py-8">No efforts yet</p>
    );
  }

  const scoreLabel = getScoreLabel(challengeType);
  const topEntries = entries.slice(0, 10);

  return (
    <div className="space-y-2">
      {topEntries.map((entry) => {
        const isCurrentUser = entry.user_id === currentUserId;
        return (
          <div
            key={entry.user_id}
            className={`flex items-center gap-3 p-3 rounded-lg border ${
              isCurrentUser
                ? 'bg-orange-50 border-orange-200'
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <span className="font-bold w-6 text-center text-gray-600">
              #{entry.rank}
            </span>

            {entry.user_profile_pic ? (
              <img
                src={entry.user_profile_pic}
                alt={entry.user_name}
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-300" />
            )}

            <div className="flex-1 min-w-0">
              <p
                className={`font-medium truncate ${
                  isCurrentUser ? 'text-orange-700' : 'text-gray-900'
                }`}
              >
                {entry.user_name}
              </p>
              <p className="text-xs text-gray-500">
                {entry.effort_count} efforts
              </p>
            </div>

            <div className="text-right">
              <p
                className={`font-bold text-lg ${
                  isCurrentUser ? 'text-orange-600' : 'text-gray-900'
                }`}
              >
                {entry.score}
              </p>
              <p className="text-xs text-gray-500">{scoreLabel}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
