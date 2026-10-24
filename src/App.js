import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import './App.css';
import logo from './assets/pagebound-logo.png';
import ThemeSelector from './components/ThemeSelector';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import Library from './pages/Library';
import Sessions from './pages/Sessions';
import Friends from './pages/Friends';
import FriendProfile from './pages/FriendProfile';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Signup from './pages/Signup';
import PasswordReset from './pages/PasswordReset';

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [authPage, setAuthPage] = useState('login'); // 'login', 'signup', or 'reset'
  const [selectedFriendId, setSelectedFriendId] = useState(null);
  // A session to open on the Sessions tab (from Home's Reading now row)
  const [focusSessionId, setFocusSessionId] = useState(null);

  const navigate = (page) => {
    setFocusSessionId(null);
    setCurrentPage(page);
  };

  const openSession = (sessionId) => {
    setFocusSessionId(sessionId);
    setCurrentPage('sessions');
  };
  const { user, loading } = useAuth();

  const handleViewFriendProfile = (friendId) => {
    setSelectedFriendId(friendId);
    setCurrentPage('friendProfile');
  };

  const renderPage = () => {
    // Dev-only pattern library for feed notifications: ?preview&patterns
    if (process.env.NODE_ENV === 'development' && window.location.search.includes('patterns')) {
      const NotificationPatterns = require('./pages/NotificationPatterns').default;
      return <NotificationPatterns />;
    }
    switch(currentPage) {
      case 'home':
        return <Home onNavigate={navigate} onOpenSession={openSession} />;
      case 'library':
        return <Library onNavigate={setCurrentPage} />;
      case 'sessions':
        return <Sessions focusSessionId={focusSessionId} />;
      case 'friends':
        return <Friends onNavigateToFriendProfile={handleViewFriendProfile} />;
      case 'friendProfile':
        return <FriendProfile friendUserId={selectedFriendId} onNavigate={setCurrentPage} />;
      case 'profile':
        return <Profile
          onNavigateToSettings={() => setCurrentPage('settings')}
          onNavigateToAdmin={() => setCurrentPage('admin')}
        />;
      case 'settings':
        return <Settings />;
      case 'admin':
        return <Admin />;
      default:
        return <Home onNavigate={navigate} onOpenSession={openSession} />;
    }
  };

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="App">
        <div className="loading-container">
          <h1 className="app-logo"><img src={logo} alt="Pagebound" /></h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Show login/signup/reset if not authenticated
  if (!user) {
    return (
      <div className="App auth-app">
        <header className="App-header">
          <h1 className="app-logo"><img src={logo} alt="Pagebound" /></h1>
          <p>Read together. Stay in sync. No spoilers.</p>
        </header>
        
        <main className="App-main">
          {authPage === 'login' ? (
            <Login 
              onNavigateToSignup={() => setAuthPage('signup')}
              onNavigateToReset={() => setAuthPage('reset')}
            />
          ) : authPage === 'signup' ? (
            <Signup onNavigateToLogin={() => setAuthPage('login')} />
          ) : (
            <PasswordReset onNavigateToLogin={() => setAuthPage('login')} />
          )}
        </main>

        {/* Theme selector for first-time users */}
        <div className="auth-theme-selector">
          <ThemeSelector />
        </div>
      </div>
    );
  }

  // Show main app if authenticated
  return (
    <div className="App">
      <header className="App-header">
        <h1 className="app-logo"><img src={logo} alt="Pagebound" /></h1>
        <p>Read together. Stay in sync. No spoilers.</p>
      </header>
      
      <main className="App-main">
        {renderPage()}
      </main>
      
      {/* Only show bottom nav on main pages, not settings/admin/friendProfile */}
      {!['settings', 'admin', 'friendProfile'].includes(currentPage) && (
        <BottomNav currentPage={currentPage} onNavigate={navigate} />
      )}

      {/* Back button for settings and admin */}
      {['settings', 'admin'].includes(currentPage) && (
        <button className="back-to-profile" onClick={() => setCurrentPage('profile')}>
          ← Back to Profile
        </button>
      )}

      {/* Back button for friend profile */}
      {currentPage === 'friendProfile' && (
        <button className="back-to-profile" onClick={() => setCurrentPage('friends')}>
          ← Back to Friends
        </button>
      )}
    </div>
  );
}

export default App;
