import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserStats } from '../utils/profileService';
import './Profile.css';

function Profile({ onNavigateToSettings, onNavigateToAdmin }) {
  const { user, userProfile, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      if (userProfile?.email) {
        try {
          const userStats = await getUserStats(userProfile.email);
          setStats(userStats);
        } catch (error) {
          console.error('Error loading stats:', error);
          // Set default stats if error
          setStats({
            chaptersCompleted: 0,
            booksRead: 0,
            totalBooks: 0
          });
        } finally {
          setLoadingStats(false);
        }
      }
    };
    loadStats();
  }, [userProfile]);

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to log out?')) {
      await logout();
    }
  };

  return (
    <div className="page profile-page">
      <div className="profile-header">
        <div className="profile-avatar-container">
          {userProfile?.avatarUrl ? (
            <img
              src={userProfile.avatarUrl}
              alt={userProfile.username}
              className="profile-avatar-image"
            />
          ) : (
            <div className="profile-avatar-letter">
              {userProfile?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
          <button
            className="edit-avatar-btn"
            onClick={onNavigateToSettings}
            title="Edit profile picture"
            aria-label="Edit profile picture"
          >
            📷
          </button>
        </div>

        <h2>{userProfile?.username || 'User'}</h2>

        {userProfile?.tagline && (
          <p className="profile-tagline">"{userProfile.tagline}"</p>
        )}

        <p className="profile-email">{user?.signInDetails?.loginId || ''}</p>
      </div>

      {/* Stats Section */}
      {!loadingStats && stats && (
        <div className="profile-stats">
          <div className="stat-item">
            <span className="stat-value">{stats.chaptersCompleted || 0}</span>
            <span className="stat-label">Chapters</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.booksRead || 0}</span>
            <span className="stat-label">Books Read</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{userProfile?.friendsCount || 0}</span>
            <span className="stat-label">Friends</span>
          </div>
        </div>
      )}

      {/* Favorite Books Section */}
      {userProfile?.favoriteBooks && userProfile.favoriteBooks.length > 0 && (
        <div className="favorite-books-section">
          <h3>Favorite Books</h3>
          <div className="favorite-books-grid">
            {userProfile.favoriteBooks.map((book) => (
              <div key={book.isbn} className="favorite-book-card">
                {book.coverUrl ? (
                  <img src={book.coverUrl} alt={book.title} />
                ) : (
                  <div className="book-placeholder">📚</div>
                )}
                <p className="book-title">{book.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}

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
