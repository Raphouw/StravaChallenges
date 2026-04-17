import React, { useState } from 'react';
import { Challenge } from '@/types/index.js';
import { useLeaderboard } from '@/hooks/useLeaderboard.js';

interface ChallengeCardProps {
  challenge: Challenge & { is_owner: boolean; is_member: boolean; member_count: number };
  jwt: string | null;
  userId: string;
  isAdmin?: boolean;
  onJoinClick: () => void;
  onDelete?: (challengeId: string) => void;
}

const typeLabel: Record<string, string> = { count: 'count', time: 'time', elevation: 'elevation', distance: 'distance' };
const typeIcon: Record<string, string> = { count: '🔢', time: '⏱️', elevation: '⛰️', distance: '📏' };

function formatTime(seconds: number): string {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
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
  const canDelete = isOwner || isAdmin;
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [copied, setCopied] = useState(false);
  const { entries, totals, segment, loading: lbLoading } = useLeaderboard(challenge.id, jwt);

  const now = Date.now();
  const start = new Date(challenge.starts_at).getTime();
  const end = new Date(challenge.ends_at).getTime();
  const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  const isEnded = daysLeft <= 0;
  const progress = Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));

  const userEntry = entries.find(e => e.user_id === userId);
  const displayEntries = entries.slice(0, 5);

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: '#12121a', borderColor: 'rgba(255,255,255,0.08)' }}
    >
      {/* Orange top accent */}
      <div className="h-0.5 w-full" style={{ background: 'linear-gradient(to right, #fb923c, #f97316)' }} />

      <div className="p-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="text-white font-semibold text-sm truncate">{challenge.name}</span>
              {isOwner && (
                <span className="text-[10px] font-bold text-orange-400 border border-orange-500/30 rounded px-1.5 py-0.5" style={{ background: 'rgba(251,146,60,0.1)' }}>
                  Owner
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              {typeIcon[challenge.type]} {typeLabel[challenge.type]} · {isEnded ? 'Ended' : `${daysLeft}d left`}
            </p>
          </div>
          {canDelete && (
            <button
              onClick={() => {
                if (window.confirm('Delete this challenge?')) onDelete?.(challenge.id);
              }}
              className="text-slate-600 hover:text-red-400 transition flex-shrink-0 p-0.5"
            >
              🗑️
            </button>
          )}
        </div>

        {/* Stats row */}
        {totals && (
          <div className="flex gap-3 mb-2 text-[10px] text-slate-400">
            <span>👥 {totals.active_participants}</span>
            <span>📏 {Math.round(totals.total_distance * 10) / 10} km</span>
            <span>⛰️ {Math.round(totals.total_elevation)}m D+</span>
          </div>
        )}

        {/* Progress bar */}
        <div className="h-0.5 rounded-full mb-3 overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${progress}%`, background: isEnded ? '#475569' : '#fb923c' }}
          />
        </div>

        {/* Invite code (owner only) */}
        {challenge.invite_code && (isOwner || challenge.is_member) && (
          <div
            className="flex items-center justify-between rounded-lg px-2.5 py-1.5 mb-2"
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div>
              <p className="text-[9px] text-slate-600 uppercase tracking-wider">Code</p>
              <code className="text-xs font-mono font-bold text-orange-400">{challenge.invite_code}</code>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(challenge.invite_code || '');
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="text-[10px] text-slate-500 hover:text-slate-300 transition px-1.5 py-1 rounded"
            >
              {copied ? '✓' : '📋'}
            </button>
          </div>
        )}

        {/* Segment info */}
        {segment && (
          <div className="mb-2 pb-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] text-slate-400">
              🏔️ <span className="text-slate-300">{segment.name}</span>
              {segment.distance ? ` · ${(segment.distance / 1000).toFixed(1)} km` : ''}
              {segment.elevation_gain ? ` · ${Math.round(segment.elevation_gain)}m D+` : ''}
            </p>
          </div>
        )}

        {/* User position badge */}
        {userEntry && (
          <div className="mb-2">
            <p className={`text-xs font-semibold ${userEntry.rank === 1 ? 'text-orange-400' : 'text-slate-400'}`}>
              {userEntry.rank === 1 ? '🏆 You lead!' : `📍 #${userEntry.rank} · ${userEntry.delta_from_leader}`}
            </p>
          </div>
        )}

        {/* Leaderboard toggle */}
        <button
          onClick={() => setShowLeaderboard(v => !v)}
          className="w-full flex items-center justify-between text-[11px] text-slate-500 hover:text-slate-300 transition py-1"
        >
          <span>▼ Leaderboard ({entries.length})</span>
          <span>{showLeaderboard ? '▲' : '▼'}</span>
        </button>

        {showLeaderboard && (
          <div className="mt-2 space-y-1">
            {lbLoading ? (
              <p className="text-[10px] text-slate-600 text-center py-2">Loading...</p>
            ) : displayEntries.length === 0 ? (
              <p className="text-[10px] text-slate-600 text-center py-2">No efforts yet</p>
            ) : (
              displayEntries.map((entry, idx) => (
                <div
                  key={entry.user_id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                  style={{
                    background: entry.user_id === userId ? 'rgba(251,146,60,0.08)' : 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <span className="text-xs text-slate-500 w-5 text-center">
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                  </span>
                  <span className="text-[11px] text-slate-300 flex-1 truncate">{entry.user_name}</span>
                  <span className="text-[10px] text-slate-500">
                    {challenge.type === 'count' && `${entry.effort_count} efforts`}
                    {challenge.type === 'time' && formatTime(entry.best_time)}
                    {challenge.type === 'elevation' && `${Math.round(entry.total_elevation)}m`}
                    {challenge.type === 'distance' && `${entry.total_distance?.toFixed(1)} km`}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
