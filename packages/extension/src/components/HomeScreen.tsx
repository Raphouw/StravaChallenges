import React, { useEffect, useState } from 'react';
import { User, Challenge } from '@/types/index.js';
import { Button, Card, Avatar } from './shared/index.js';
import { LeaderboardCard } from './LeaderboardCard.js';
import { CreateChallengeModal, JoinChallengeModal } from './modals/index.js';
import { useAuth } from '@/hooks/useAuth.js';
import { useUserProfile } from '@/hooks/useUserProfile.js';
import { useChallengesList } from '@/hooks/useChallengesList.js';
import { useLeaderboard } from '@/hooks/useLeaderboard.js';

interface HomeScreenProps {
  user: User | null;
  challenges: Challenge[];
  loading?: boolean;
  onLogout: () => void;
}

export function HomeScreen({
  user: initialUser,
  challenges: _,
  loading: __ ,
  onLogout,
}: HomeScreenProps) {
  const auth = useAuth();
  const { user: profileUser, loading: profileLoading } = useUserProfile(auth.jwt);
  const user = profileUser || initialUser;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { challenges, loading } = useChallengesList(auth.jwt, refreshKey);
  return (
    <div className="w-full h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {profileLoading ? (
              <div className="w-12 h-12 rounded-full bg-gray-200 animate-pulse" />
            ) : (
              <Avatar
                src={user?.profile_pic_url}
                alt={user?.name || 'User'}
                size="md"
              />
            )}
            <div className="text-left flex-1">
              {profileLoading ? (
                <>
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-2" />
                  <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
                </>
              ) : (
                <>
                  <h2 className="font-semibold text-gray-900 truncate">{user?.name || 'Unknown User'}</h2>
                  <p className="text-xs text-gray-500">Strava #{user?.strava_id || '-'}</p>
                </>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
          >
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Active Challenges
          </h3>

          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading challenges...</p>
            </div>
          ) : challenges.length === 0 ? (
            <Card className="text-center py-8">
              <p className="text-gray-500 mb-4">No active challenges yet</p>
              <div className="flex gap-2 justify-center">
                <Button
                  size="sm"
                  onClick={() => setShowCreateModal(true)}
                >
                  Create
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowJoinModal(true)}
                >
                  Join
                </Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {challenges.map((challenge) => {
                const isOwner = (challenge as any).is_owner;
                const isMember = (challenge as any).is_member;
                const { entries: leaderboardEntries, loading: leaderboardLoading } = useLeaderboard(challenge.id, auth.jwt);

                return (
                  <Card key={challenge.id}>
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
                            onClick={() => setShowJoinModal(true)}
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
                          currentUserId={user?.id || ''}
                        />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-200 p-4 flex gap-2">
        <Button
          className="flex-1"
          onClick={() => setShowCreateModal(true)}
        >
          Create Challenge
        </Button>
        <Button
          className="flex-1"
          variant="secondary"
          onClick={() => setShowJoinModal(true)}
        >
          Join Challenge
        </Button>
      </div>

      {/* Modals */}
      {auth.jwt && (
        <>
          <CreateChallengeModal
            isOpen={showCreateModal}
            jwt={auth.jwt}
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setRefreshKey((prev) => prev + 1);
            }}
          />
          <JoinChallengeModal
            isOpen={showJoinModal}
            jwt={auth.jwt}
            onClose={() => setShowJoinModal(false)}
            onSuccess={() => {
              setRefreshKey((prev) => prev + 1);
            }}
          />
        </>
      )}
    </div>
  );
}
