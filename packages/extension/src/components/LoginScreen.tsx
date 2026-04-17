import React, { useEffect } from 'react';
import { Button } from './shared/index.js';
import { User } from '@/types/index.js';

interface LoginScreenProps {
  onLoginSuccess: (jwt: string, user: User) => void;
  loading?: boolean;
}

export function LoginScreen({ onLoginSuccess, loading = false }: LoginScreenProps) {
  useEffect(() => {
    const handleMessage = (
      message: any,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void
    ) => {
      if (message.action === 'AUTH_SUCCESS') {
        onLoginSuccess(message.jwt, message.user);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [onLoginSuccess]);

  const handleConnectStrava = () => {
    chrome.tabs.create({
      url: 'https://strava-challenges-dashboard.vercel.app/api/auth/strava',
    });
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-black p-6">
      <div className="text-center max-w-xs">
        <div className="mb-6">
          <div className="text-5xl mb-4">⚡</div>
          <h1 className="text-2xl font-bold text-white mb-2">
            StravaChallenge
          </h1>
          <p className="text-sm text-gray-400">
            Compete with friends on every climb
          </p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-lg">🏔️</span>
              <div className="text-left">
                <p className="text-sm font-semibold text-white">Real-time Updates</p>
                <p className="text-xs text-gray-400">Track efforts instantly</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-lg">👥</span>
              <div className="text-left">
                <p className="text-sm font-semibold text-white">Group Leaderboards</p>
                <p className="text-xs text-gray-400">Compete in real-time</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-lg">⚡</span>
              <div className="text-left">
                <p className="text-sm font-semibold text-white">Auto-tracked</p>
                <p className="text-xs text-gray-400">No manual logging</p>
              </div>
            </div>
          </div>
        </div>

        <Button
          onClick={handleConnectStrava}
          disabled={loading}
          className="w-full mb-4 bg-orange-600 hover:bg-orange-700 text-white font-semibold"
        >
          {loading ? 'Connecting...' : '🔗 Connect with Strava'}
        </Button>

        <p className="text-xs text-gray-500">
          We only access your activity data with your permission
        </p>
      </div>
    </div>
  );
}
