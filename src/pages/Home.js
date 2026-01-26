import React, { useState } from 'react';
import { mockUser, mockActivityFeed } from '../mockData';
import { useSession } from '../context/SessionContext';
import ActiveSessions from '../components/ActiveSessions';
import ActivityFeed from '../components/ActivityFeed';
import QuickSessionSetup from '../components/QuickSessionSetup';
import './Home.css';

function Home() {
  const { sessions, createSession } = useSession();
  const [showQuickSetup, setShowQuickSetup] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);

  const handleSuggestSession = (activity) => {
    setSelectedActivity(activity);
    setShowQuickSetup(true);
  };

  const handleCreateQuickSession = (sessionData) => {
    createSession(sessionData);
    setShowQuickSetup(false);
    setSelectedActivity(null);
  };

  return (
    <div className="page home-page">
      <div className="home-header">
        <h2>Welcome back, {mockUser.name}!</h2>
        <div className="friend-count">
          <span className="friend-icon">👥</span>
          <p>{mockUser.friendCount} friends reading</p>
        </div>
      </div>

      {sessions.length > 0 ? (
        <ActiveSessions sessions={sessions} />
      ) : (
        <div className="no-sessions">
          <h3>No Active Sessions</h3>
          <p>Start a reading session from your library or join a friend below!</p>
        </div>
      )}
      
      <ActivityFeed 
        activities={mockActivityFeed} 
        onSuggestSession={handleSuggestSession}
      />

      {showQuickSetup && selectedActivity && (
        <QuickSessionSetup
          activity={selectedActivity}
          onClose={() => {
            setShowQuickSetup(false);
            setSelectedActivity(null);
          }}
          onCreateSession={handleCreateQuickSession}
        />
      )}
    </div>
  );
}

export default Home;
