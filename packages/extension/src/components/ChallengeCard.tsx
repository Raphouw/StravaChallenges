import React from 'react';
import { Challenge } from '@/types/index.js';
import { Button, Card } from './shared/index.js';
import { LeaderboardCard } from './LeaderboardCard.js';
import { useLeaderboard } from '@/hooks/useLeaderboard.js';

interface ChallengeCardProps {
  challenge: Challenge & { is_owner: boolean; is_member: boolean; member_count: number };
  jwt: string | null;
  userId: string;
  isAdmin?: boolean;
  onJoinClick: () => void;
  onDelete?: (challengeId: string) => void;
}

export function ChallengeCard({
  challenge,
  jwt,
  userId,
  isAdmin,
  onJoinClick,
  onDelete,
}: ChallengeCardProps) {
  const isOwner = challenge.is_owner;
  const isMember = challenge.is_member;
  const canDelete = isOwner || isAdmin;
  const { entries: leaderboardEntries, totals, segment, loading: leaderboardLoading } = useLeaderboard(challenge.id, jwt);

  const daysRemaining = Math.ceil(
    (new Date(challenge.ends_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  const userPosition = leaderboardEntries.find(e => e.user_id === userId);

  return (
    <Card>
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-gray-900">
                {challenge.name}
              </h4>
              {isOwner && (
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                  Owner
                </span>
              )}
            </div>
            <div className="mt-1 space-y-1">
              <p className="text-xs text-gray-600">
                {challenge.type} challenge • {daysRemaining > 0 ? `${daysRemaining}d left` : 'Ended'}
              </p>
              {userPosition && (
                <p className={`text-xs font-semibold ${userPosition.rank === 1 ? 'text-orange-600' : 'text-gray-600'}`}>
                  {userPosition.rank === 1
                    ? '🏆 You lead!'
                    : `📍 ${userPosition.rank}${['st', 'nd', 'rd'][userPosition.rank - 1] || 'th'}, ${userPosition.delta_from_leader}`}
                </p>
              )}
              {totals && (
                <p className="text-xs text-gray-500">
                  {totals.active_participants} participants • {Math.round(totals.total_distance)} km • {totals.total_elevation}m D+
                </p>
              )}
            </div>
            {isOwner && challenge.invite_code && (
              <div className="mt-2 p-2 bg-gray-50 rounded flex items-center justify-between">
                <span className="text-xs text-gray-600">
                  Code: <span className="font-mono font-semibold">{challenge.invite_code}</span>
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(challenge.invite_code || '');
                  }}
                  className="text-xs text-orange-600 hover:text-orange-700 font-medium"
                >
                  Copy
                </button>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {!isMember && (
              <Button
                variant="primary"
                size="sm"
                onClick={onJoinClick}
                className="flex-1"
              >
                Join
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (window.confirm('Delete this challenge?')) {
                    onDelete?.(challenge.id);
                  }
                }}
                className="text-red-600 hover:text-red-700"
              >
                🗑️
              </Button>
            )}
          </div>
        </div>

        {/* Segment Info */}
        {segment && (
          <div className="pt-2 border-t border-gray-200">
            <a
              href={`https://www.strava.com/segments/${segment.strava_segment_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block hover:bg-gray-50 rounded p-2 transition"
            >
              <p className="text-xs font-semibold text-gray-700">Segment</p>
              <p className="text-xs text-orange-600 font-medium hover:underline">
                {segment.name}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {(segment.distance / 1000).toFixed(1)} km • {segment.elevation_gain}m D+
              </p>
            </a>
          </div>
        )}

        {/* Leaderboard */}
        <div className="pt-2 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-700 mb-2">Leaderboard</p>
          <LeaderboardCard
            entries={leaderboardEntries}
            loading={leaderboardLoading}
            challengeType={challenge.type}
            currentUserId={userId}
          />
        </div>
      </div>
    </Card>
  );
}
