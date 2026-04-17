'use client'

import { useAuth } from '@/hooks/useAuth'
import { Avatar } from './Avatar'

export function Navbar() {
  const { user, token, logout } = useAuth()

  const handleConnect = () => {
    const redirectUrl = `${window.location.origin}/auth-callback`
    window.location.href = `https://strava-challenges-extension.vercel.app/api/auth/strava?redirect_url=${encodeURIComponent(redirectUrl)}`
  }

  const handleDisconnect = () => {
    logout()
  }

  return (
    <nav className="fixed top-0 w-full bg-slate-900/80 backdrop-blur-sm border-b border-slate-700/50 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <a href="/" className="flex items-center gap-3 hover:opacity-80 transition">
          <span className="text-2xl">⚡</span>
          <div>
            <h1 className="font-bold text-white text-lg">StravaChallenge</h1>
            <p className="text-xs text-gray-400">Compete with friends on every climb</p>
          </div>
        </a>
        <div className="flex items-center gap-4">
          {user && token ? (
            <>
              <div className="flex items-center gap-3">
                <Avatar src={user.profile_pic_url} name={user.name} size="sm" />
                <div className="text-right">
                  <p className="text-sm font-medium text-white">{user.name}</p>
                  <p className="text-xs text-gray-400">Strava #{user.strava_id}</p>
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                className="px-4 py-2 bg-red-900/50 hover:bg-red-900 text-red-400 text-sm font-medium rounded-lg transition-colors border border-red-800/50"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={handleConnect}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              🔗 Connect with Strava
            </button>
          )}
          <a
            href="https://chrome.google.com/webstore"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Get Extension
          </a>
        </div>
      </div>
    </nav>
  )
}
