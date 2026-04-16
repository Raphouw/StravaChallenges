import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { LoginScreen } from './components/LoginScreen.js';
import { HomeScreen } from './components/HomeScreen.js';
import { useAuth } from './hooks/useAuth.js';
import { useChallenges } from './hooks/useChallenges.js';
import { User } from './types/index.js';
import './popup.css';

function App() {
  const auth = useAuth();
  const challenges = useChallenges(auth.jwt);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLoginSuccess = (jwt: string, user: User) => {
    auth.setAuth(jwt, user);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await auth.logout();
    setIsLoggingOut(false);
  };

  if (auth.loading) {
    return (
      <div className="w-popup h-popup flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (auth.error) {
    return (
      <div className="w-popup h-popup flex items-center justify-center bg-gray-50 p-4">
        <p className="text-red-600 text-center">Error: {auth.error}</p>
      </div>
    );
  }

  return (
    <div className="w-popup h-popup overflow-hidden bg-white">
      {!auth.jwt || !auth.user ? (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      ) : (
        <HomeScreen
          user={auth.user}
          challenges={challenges.challenges}
          loading={challenges.loading}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('Popup error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '10px', color: 'red', fontSize: '12px', whiteSpace: 'pre-wrap', overflowY: 'auto', maxHeight: '560px' }}>
          <strong>Error:</strong> {this.state.error?.message}
          <br />
          <br />
          <small style={{ color: '#666' }}>
            {this.state.error?.stack}
          </small>
        </div>
      );
    }

    return this.props.children;
  }
}

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
