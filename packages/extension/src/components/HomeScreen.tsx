import React from 'react';
import { User, Challenge } from '@/types/index.js';
import { Button, Card, Avatar } from './shared/index.js';

interface HomeScreenProps {
  user: User;
  challenges: Challenge[];
  loading?: boolean;
  onLogout: () => void;
}

export function HomeScreen({
  user,
  challenges,
  loading = false,
  onLogout,
}: HomeScreenProps) {
  return (
    <div className="w-full h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar
              src={user.profile_pic_url}
              alt={user.name}
              size="md"
            />
            <div className="text-left">
              <h2 className="font-semibold text-gray-900">{user.name}</h2>
              <p className="text-xs text-gray-500">Strava ID: {user.strava_id}</p>
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
              <Button size="sm" className="mx-auto">
                Create Challenge
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {challenges.map((challenge) => (
                <Card key={challenge.id}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">
                        {challenge.name}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {challenge.type} challenge
                      </p>
                      <p className="text-xs text-gray-500">
                        Until {new Date(challenge.ends_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button variant="primary" size="sm">
                      Join
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-200 p-4">
        <Button className="w-full" variant="secondary">
          Create New Challenge
        </Button>
      </div>
    </div>
  );
}
