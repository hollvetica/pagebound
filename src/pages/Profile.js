import React from 'react';
import { useAuth } from '../context/AuthContext';
import './Profile.css';

function Profile({ onNavigateToSettings, onNavigateToAdmin }) {
  const { user, userProfile, logout } = useAuth();

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to log out?')) {
      await logout();
    }
  };

  return (
    <div className="page profile-page">
      <div className="profile-header">
        <div className="profile-avatar">
          {userProfile?.username?.charAt(0).toUpperCase() || 'U'}
        </div>
        <h2>{userProfile?.username || 'User'}</h2>
        <p className="profile-email">{user?.signInDetails?.loginId || ''}</p>
      </div>

      <div className="profile-actions">
        <button className="profile-action-button" onClick={onNavigateToSettings}>
          <span className="button-icon">⚙️</span>
          Settings
        </button>

        {userProfile?.isAdmin && (
          <button className="profile-action-button admin-button" onClick={onNavigateToAdmin}>
            <span className="button-icon">👑</span>
            Admin Panel
          </button>
        )}

        <button className="logout-button" onClick={handleLogout}>
          Log Out
        </button>
      </div>
    </div>
  );
}

export default Profile;
