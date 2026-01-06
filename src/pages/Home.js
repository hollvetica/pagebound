import React from 'react';
import { mockUser, mockActiveSessions, mockActivityFeed } from '../mockData';
import ActiveSessions from '../components/ActiveSessions';
import ActivityFeed from '../components/ActivityFeed';
import './Home.css';

function Home() {
  return (
    <div className="page home-page">
      <div className="home-header">
        <h2>Welcome back, {mockUser.name}!</h2>
        <div className="friend-count">
          <span className="friend-icon">👥</span>
          <p>{mockUser.friendCount} friends reading</p>
        </div>
      </div>

      <ActiveSessions sessions={mockActiveSessions} />
      
      <ActivityFeed activities={mockActivityFeed} />
    </div>
  );
}

export default Home;