import React from 'react';
import { useFriends } from '../context/FriendsContext';
import { Users, MessageCircle, UserMinus } from 'lucide-react';
import './FriendsList.css';

function FriendsList({ onViewProfile }) {
  const { friends, loading, error, removeFriend } = useFriends();

  const handleRemoveFriend = async (friend) => {
    if (window.confirm(`Remove ${friend.friendDisplayName} from your friends?`)) {
      try {
        await removeFriend(friend.friendUserId);
      } catch (err) {
        alert('Failed to remove friend. Please try again.');
      }
    }
  };

  const handleViewProfile = (friend) => {
    if (onViewProfile) {
      onViewProfile(friend.friendUserId);
    }
  };

  if (loading) {
    return (
      <div className="friends-loading">
        <p>Loading friends...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="friends-error">
        <p>{error}</p>
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <div className="friends-empty">
        <Users size={48} />
        <h3>No friends yet</h3>
        <p>Start adding friends to see them here!</p>
      </div>
    );
  }

  return (
    <div className="friends-list">
      <div className="friends-count">
        <Users size={18} />
        <span>{friends.length} {friends.length === 1 ? 'Friend' : 'Friends'}</span>
      </div>

      <div className="friends-grid">
        {friends.map(friend => (
          <div key={friend.friendUserId} className="friend-card">
            <div
              className="friend-info"
              onClick={() => handleViewProfile(friend)}
              style={{ cursor: 'pointer' }}
            >
              <div className="friend-avatar">
                {friend.friendAvatarUrl ? (
                  <img src={friend.friendAvatarUrl} alt={friend.friendDisplayName} />
                ) : (
                  <div className="friend-avatar-placeholder">
                    {friend.friendDisplayName?.charAt(0).toUpperCase() || 'F'}
                  </div>
                )}
              </div>
              <div className="friend-details">
                <h3>{friend.friendDisplayName}</h3>
                <p>@{friend.friendUsername}</p>
              </div>
            </div>

            <div className="friend-actions">
              <button
                className="friend-action-btn message-btn"
                title="Start a session"
              >
                <MessageCircle size={18} />
              </button>
              <button
                className="friend-action-btn remove-btn"
                onClick={() => handleRemoveFriend(friend)}
                title="Remove friend"
              >
                <UserMinus size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FriendsList;
