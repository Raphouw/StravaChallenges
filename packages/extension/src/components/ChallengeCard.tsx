import React from 'react';
import { Challenge } from '@/types/index.js';
import { Button, Card } from './shared/index.js';
import { LeaderboardCard } from './LeaderboardCard.js';
import { useLeaderboard } from '@/hooks/useLeaderboard.js';

interface ChallengeCardProps {
  challenge: Challenge & { is_owner: boolean; is_member: boolean; member_count: number };
  jwt: string | null;
  userId: string;
  onJoinClick: () => void;
}

export function ChallengeCard({
  challenge,
  jwt,
  userId,
  onJoinClick,
}: ChallengeCardProps) {
  const isOwner = challenge.is_owner;
  const isMember = challenge.is_member;
  const { entries: leaderboardEntries, loading: leaderboardLoading } = useLeaderboard(challenge.id, jwt);

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
            <p className="text-xs text-gray-500 mt-1">
              {challenge.type} challenge
            </p>
            <p className="text-xs text-gray-500">
              Until {new Date(challenge.ends_at).toLocaleDateString()}
            </p>
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
          {!isMember && (
            <Button
              variant="primary"
              size="sm"
              onClick={onJoinClick}
            >
              Join
            </Button>
          )}
        </div>

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
