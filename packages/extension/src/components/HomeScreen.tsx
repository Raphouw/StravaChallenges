import React, { useEffect, useState } from 'react';
import { User, Challenge } from '@/types/index.js';
import { Button, Card, Avatar } from './shared/index.js';
import { ChallengeCard } from './ChallengeCard.js';
import { CreateChallengeModal, JoinChallengeModal } from './modals/index.js';
import { useAuth } from '@/hooks/useAuth.js';
import { useUserProfile } from '@/hooks/useUserProfile.js';
import { useChallengesList } from '@/hooks/useChallengesList.js';

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
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { challenges, loading } = useChallengesList(auth.jwt, refreshKey);
  const isAdmin = user?.is_admin === true;

  const handleDeleteChallenge = async (challengeId: string) => {
    if (!window.confirm('Are you sure you want to delete this challenge?')) {
      return;
    }

    try {
      const response = await fetch(
        'https://strava-challenges-extension.vercel.app/api/challenges/delete',
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${auth.jwt}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ challengeId }),
        }
      );

      if (response.ok) {
        setRefreshKey((prev) => prev + 1);
      } else {
        alert('Failed to delete challenge');
      }
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Error deleting challenge');
    }
  };

  const openDashboard = () => {
    const dashboardUrl = 'https://strava-challenges-extension.vercel.app';
    chrome.tabs.create({ url: dashboardUrl });
  };

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-b from-slate-900 to-black text-white">
      {/* Header */}
      <div className="bg-gradient-to-b from-slate-800/50 to-slate-900 border-b border-slate-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 flex-1">
            {profileLoading ? (
              <div className="w-10 h-10 rounded-full bg-slate-700 animate-pulse" />
            ) : (
              <Avatar
                src={user?.profile_pic_url}
                alt={user?.name || 'User'}
                size="md"
              />
            )}
            <div className="text-left flex-1 min-w-0">
              {profileLoading ? (
                <>
                  <div className="h-3 w-20 bg-slate-700 rounded animate-pulse mb-1" />
                  <div className="h-2 w-16 bg-slate-700 rounded animate-pulse" />
                </>
              ) : (
                <>
                  <h2 className="font-semibold text-white text-sm truncate">{user?.name || 'Unknown'}</h2>
                  <p className="text-xs text-gray-400">Strava #{user?.strava_id || '-'}</p>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onLogout}
            className="text-xs text-gray-400 hover:text-gray-200 transition px-2 py-1 rounded hover:bg-slate-700/50"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold py-2 px-3 rounded transition"
          >
            + Create
          </button>
          <button
            onClick={() => setShowJoinModal(true)}
            className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold py-2 px-3 rounded transition"
          >
            📌 Join
          </button>
        </div>

        {/* Challenges Section */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <span>🏔️</span> Active Challenges
          </h3>

          {loading ? (
            <div className="text-center py-6">
              <div className="inline-block w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-gray-400 mt-2">Loading...</p>
            </div>
          ) : challenges.length === 0 ? (
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-center">
              <p className="text-xs text-gray-400">No challenges yet</p>
              <p className="text-xs text-gray-500 mt-1">Create or join one to get started!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {challenges.map((challenge) => (
                <ChallengeCard
                  key={challenge.id}
                  challenge={challenge as any}
                  jwt={auth.jwt}
                  userId={user?.id || ''}
                  isAdmin={isAdmin}
                  onJoinClick={() => setShowJoinModal(true)}
                  onDelete={handleDeleteChallenge}
                />
              ))}
            </div>
          )}
        </div>

        {/* Admin Panel */}
        {isAdmin && showAdminPanel && (
          <div className="bg-purple-900/20 border border-purple-700/30 rounded-lg p-3 mb-4">
            <p className="text-xs font-semibold text-purple-300 mb-2">🔐 Admin Panel</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {challenges.map((challenge) => (
                <div
                  key={challenge.id}
                  className="flex items-center justify-between bg-slate-800/50 p-2 rounded text-xs border border-slate-700"
                >
                  <span className="truncate flex-1 text-gray-300">{challenge.name}</span>
                  <button
                    onClick={() => handleDeleteChallenge(challenge.id)}
                    className="text-red-400 hover:text-red-300 ml-2 transition"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="bg-gradient-to-t from-slate-900 to-slate-800/50 border-t border-slate-700 p-3 space-y-2">
        <button
          onClick={openDashboard}
          className="w-full bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white text-xs font-semibold py-2 rounded transition flex items-center justify-center gap-2"
        >
          📊 Open Dashboard
        </button>

        {isAdmin && (
          <button
            onClick={() => setShowAdminPanel(!showAdminPanel)}
            className={`w-full text-xs font-semibold py-1.5 rounded transition ${
              showAdminPanel
                ? 'bg-purple-600 text-white'
                : 'bg-slate-700 hover:bg-slate-600 text-gray-200'
            }`}
          >
            {showAdminPanel ? '✓ Admin Panel' : '🔐 Admin Panel'}
          </button>
        )}
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
              setShowCreateModal(false);
            }}
          />
          <JoinChallengeModal
            isOpen={showJoinModal}
            jwt={auth.jwt}
            onClose={() => setShowJoinModal(false)}
            onSuccess={() => {
              setRefreshKey((prev) => prev + 1);
              setShowJoinModal(false);
            }}
          />
        </>
      )}
    </div>
  );
}
