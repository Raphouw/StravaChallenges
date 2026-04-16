import React, { useEffect } from 'react';
import { Button } from './shared/index.js';
import { User } from '@/types/index.js';

interface LoginScreenProps {
  onLoginSuccess: (jwt: string, user: User) => void;
  loading?: boolean;
}

export function LoginScreen({ onLoginSuccess, loading = false }: LoginScreenProps) {
  useEffect(() => {
    // Listen for message from auth-success page
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
    // Open Strava OAuth in new tab
    chrome.tabs.create({
      url: 'https://strava-challenges-extension.vercel.app/api/auth/strava',
    });
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 to-white p-6">
      <div className="text-center">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto bg-strava-orange rounded-full flex items-center justify-center text-white text-2xl font-bold">
            SC
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Strava Challenge
        </h1>
        <p className="text-gray-600 mb-8">
          Track challenges with your Strava friends
        </p>

        <Button
          onClick={handleConnectStrava}
          disabled={loading}
          className="w-full mb-4"
          size="lg"
        >
          {loading ? 'Connecting...' : 'Connect with Strava'}
        </Button>

        <p className="text-xs text-gray-500">
          We only access your activity data with your permission
        </p>
      </div>
    </div>
  );
}
