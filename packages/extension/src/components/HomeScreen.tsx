import React, { useEffect, useState } from 'react';
import { User } from '@/types/index.js';
import { Avatar } from './shared/index.js';
import { ChallengeCard } from './ChallengeCard.js';
import { CreateChallengeModal, JoinChallengeModal } from './modals/index.js';
import { useAuth } from '@/hooks/useAuth.js';
import { useUserProfile } from '@/hooks/useUserProfile.js';
import { useChallengesList } from '@/hooks/useChallengesList.js';

const API = 'https://strava-challenges-extension.vercel.app';

type Tab = 'mine' | 'active' | 'discover';

interface HomeScreenProps {
  user: User | null;
  challenges: any[];
  loading?: boolean;
  onLogout: () => void;
}

export function HomeScreen({ user: initialUser, onLogout }: HomeScreenProps) {
  const auth = useAuth();
  const { user: profileUser, loading: profileLoading } = useUserProfile(auth.jwt);
  const user = profileUser || initialUser;

  const [tab, setTab] = useState<Tab>('mine');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { challenges: myChallenges, loading: myLoading } = useChallengesList(auth.jwt, refreshKey);
  const isAdmin = user?.is_admin === true;

  const [publicChallenges, setPublicChallenges] = useState<any[]>([]);
  const [publicLoading, setPublicLoading] = useState(false);

  useEffect(() => {
    if (tab === 'active' || tab === 'discover') {
      setPublicLoading(true);
      fetch(`${API}/api/challenges/list?scope=public`)
        .then(r => r.json())
        .then(d => { setPublicChallenges(Array.isArray(d) ? d : []); setPublicLoading(false); })
        .catch(() => setPublicLoading(false));
    }
  }, [tab, refreshKey]);

  const now = Date.now();
  const myIds = new Set(myChallenges.map(c => c.id));

  const activeChallenges = publicChallenges.filter(c => {
    const end = new Date(c.ends_at).getTime();
    return end > now && !myIds.has(c.id);
  });

  const handleDelete = async (challengeId: string) => {
    if (!window.confirm('Delete this challenge?')) return;
    try {
      const res = await fetch(`${API}/api/challenges/delete`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${auth.jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId }),
      });
      if (res.ok) setRefreshKey(k => k + 1);
      else alert('Failed to delete challenge');
    } catch { alert('Error deleting challenge'); }
  };

  const handleJoinPublic = async (challengeId: string) => {
    if (!auth.jwt) return;
    try {
      const res = await fetch(`${API}/api/challenges/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: challengeId }),
      });
      if (res.ok) { setRefreshKey(k => k + 1); setTab('mine'); }
      else alert('Failed to join');
    } catch { alert('Error joining'); }
  };

  const openDashboard = () => {
    const url = isAdmin
      ? 'https://strava-challenges-dashboard.vercel.app/?admin=465786453sd4fsdfsdfsdf456'
      : 'https://strava-challenges-dashboard.vercel.app/';
    chrome.tabs.create({ url });
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'mine', label: 'My Challenges' },
    { key: 'active', label: 'Active' },
    { key: 'discover', label: 'Discover' },
  ];

  return (
    <div className="w-full h-full flex flex-col" style={{ background: '#0a0a0f', color: '#f1f5f9' }}>
      {/* Compact profile header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#12121a' }}>
        {profileLoading ? (
          <div className="w-9 h-9 rounded-full animate-pulse" style={{ background: '#1a1a28' }} />
        ) : (
          <Avatar src={user?.profile_pic_url} alt={user?.name || 'User'} size="md" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{user?.name || '—'}</p>
          <p className="text-[10px] text-slate-500">Strava #{user?.strava_id || '—'}</p>
        </div>
        <button
          onClick={onLogout}
          className="text-xs text-slate-500 hover:text-slate-300 transition px-2 py-1 rounded"
        >
          Logout
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b" style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#0a0a0f' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors relative ${tab === t.key ? 'text-orange-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {t.label}
            {tab === t.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500 rounded-t" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* MY CHALLENGES TAB */}
        {tab === 'mine' && (
          <div>
            {myLoading ? (
              <div className="text-center py-8">
                <div className="inline-block w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-xs text-slate-500">Loading...</p>
              </div>
            ) : myChallenges.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-3xl mb-2">🏔️</p>
                <p className="text-xs text-slate-400 mb-1">No challenges yet</p>
                <p className="text-[10px] text-slate-600">Create or join one to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myChallenges.map((c) => (
                  <ChallengeCard
                    key={c.id}
                    challenge={c as any}
                    jwt={auth.jwt}
                    userId={user?.id || ''}
                    isAdmin={isAdmin}
                    onJoinClick={() => setShowJoinModal(true)}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ACTIVE TAB */}
        {tab === 'active' && (
          <div>
            {publicLoading ? (
              <div className="text-center py-8">
                <div className="inline-block w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-xs text-slate-500">Loading...</p>
              </div>
            ) : activeChallenges.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-3xl mb-2">🎉</p>
                <p className="text-xs text-slate-400">You're in all active challenges!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeChallenges.map(c => (
                  <PublicChallengeCard key={c.id} challenge={c} onJoin={() => handleJoinPublic(c.id)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* DISCOVER TAB */}
        {tab === 'discover' && (
          <div>
            {publicLoading ? (
              <div className="text-center py-8">
                <div className="inline-block w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-xs text-slate-500">Loading...</p>
              </div>
            ) : publicChallenges.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-3xl mb-2">🌍</p>
                <p className="text-xs text-slate-400">No public challenges found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {publicChallenges.map(c => (
                  <PublicChallengeCard key={c.id} challenge={c} onJoin={() => handleJoinPublic(c.id)} isMember={myIds.has(c.id)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-3 py-3 border-t space-y-2" style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#0a0a0f' }}>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="py-2 rounded-lg text-xs font-semibold text-white transition"
            style={{ background: '#fb923c' }}
          >
            + Create
          </button>
          <button
            onClick={() => setShowJoinModal(true)}
            className="py-2 rounded-lg text-xs font-semibold transition"
            style={{ background: '#1a1a28', color: '#94a3b8' }}
          >
            📌 Join
          </button>
        </div>
        <button
          onClick={openDashboard}
          className="w-full py-2 rounded-lg text-xs font-semibold text-white transition"
          style={{ background: 'linear-gradient(to right, #ea580c, #c2410c)' }}
        >
          📊 Open Dashboard
        </button>
      </div>

      {auth.jwt && (
        <>
          <CreateChallengeModal
            isOpen={showCreateModal}
            jwt={auth.jwt}
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => { setRefreshKey(k => k + 1); setShowCreateModal(false); }}
          />
          <JoinChallengeModal
            isOpen={showJoinModal}
            jwt={auth.jwt}
            onClose={() => setShowJoinModal(false)}
            onSuccess={() => { setRefreshKey(k => k + 1); setShowJoinModal(false); }}
          />
        </>
      )}
    </div>
  );
}

function PublicChallengeCard({ challenge, onJoin, isMember = false }: { challenge: any; onJoin: () => void; isMember?: boolean }) {
  const now = Date.now();
  const end = new Date(challenge.ends_at).getTime();
  const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  const isEnded = daysLeft <= 0;

  const typeLabel: Record<string, string> = { count: '🔢', time: '⏱️', elevation: '⛰️', distance: '📏' };

  return (
    <div className="rounded-xl border p-3" style={{ background: '#12121a', borderColor: 'rgba(255,255,255,0.08)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs">{typeLabel[challenge.type] || '🏆'}</span>
            <span className="text-xs font-medium text-white truncate">{challenge.name}</span>
          </div>
          {challenge.segment?.segment_name && (
            <p className="text-[10px] text-slate-500 truncate">🏔️ {challenge.segment.segment_name}</p>
          )}
          <p className="text-[10px] text-slate-600 mt-0.5">
            {challenge.participant_count || 0} participants · {isEnded ? 'Ended' : `${daysLeft}d left`}
          </p>
        </div>
        {!isMember && !isEnded && (
          <button
            onClick={onJoin}
            className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition"
            style={{ background: '#fb923c' }}
          >
            Join
          </button>
        )}
        {isMember && (
          <span className="flex-shrink-0 px-2 py-1 text-[10px] text-green-400 border border-green-500/30 rounded-lg" style={{ background: 'rgba(34,197,94,0.1)' }}>
            ✓ Joined
          </span>
        )}
      </div>
    </div>
  );
}
