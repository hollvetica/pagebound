import React, { useState, useEffect } from 'react';
import { useFriends } from '../context/FriendsContext';
import { User, Users, BookOpen, MessageCircle, UserMinus } from 'lucide-react';
import './FriendProfile.css';

function FriendProfile({ friendUserId, onStartSession }) {
  const { getFriendByUserId, removeFriend } = useFriends();
  const [friend, setFriend] = useState(null);

  useEffect(() => {
    if (friendUserId) {
      const friendData = getFriendByUserId(friendUserId);
      setFriend(friendData);
    }
  }, [friendUserId, getFriendByUserId]);

  const handleRemoveFriend = async () => {
    if (window.confirm(`Remove ${friend?.friendDisplayName} from your friends?`)) {
      try {
        await removeFriend(friendUserId);
        // Navigate back will be handled by parent
      } catch (err) {
        alert('Failed to remove friend');
      }
    }
  };

  const handleStartSession = () => {
    if (onStartSession) {
      onStartSession(friend);
    }
  };

  if (!friend) {
    return (
      <div className="page friend-profile-page">
        <div className="friend-profile-loading">
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page friend-profile-page">
      <div className="friend-profile-header">
        <div className="friend-profile-avatar">
          {friend.friendAvatarUrl ? (
            <img src={friend.friendAvatarUrl} alt={friend.friendDisplayName} />
          ) : (
            <div className="friend-profile-avatar-placeholder">
              {friend.friendDisplayName?.charAt(0).toUpperCase() || 'F'}
            </div>
          )}
        </div>
        <h2>{friend.friendDisplayName}</h2>
        <p className="friend-profile-username">@{friend.friendUsername}</p>
        {friend.isPrivate && (
          <p className="friend-profile-private">
            <User size={14} />
            Private Profile
          </p>
        )}
      </div>

      <div className="friend-profile-actions">
        <button className="profile-action-btn primary" onClick={handleStartSession}>
          <MessageCircle size={18} />
          Start Reading Session
        </button>
        <button className="profile-action-btn danger" onClick={handleRemoveFriend}>
          <UserMinus size={18} />
          Remove Friend
        </button>
      </div>

      {!friend.isPrivate ? (
        <>
          <div className="friend-profile-section">
            <h3>
              <BookOpen size={18} />
              Public Bookshelves
            </h3>
            <div className="friend-bookshelves">
              <div className="empty-state">
                <BookOpen size={48} />
                <p>No public bookshelves yet</p>
                <p className="empty-hint">
                  {friend.friendDisplayName} hasn't made any bookshelves public
                </p>
              </div>
            </div>
          </div>

          <div className="friend-profile-section">
            <h3>
              <Users size={18} />
              Shared Sessions
            </h3>
            <div className="friend-sessions">
              <div className="empty-state">
                <Users size={48} />
                <p>No shared reading sessions</p>
                <p className="empty-hint">
                  Start a reading session together to see it here
                </p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="friend-profile-private-notice">
          <User size={48} />
          <h3>Private Profile</h3>
          <p>This user has a private profile. You can still start reading sessions together!</p>
        </div>
      )}
    </div>
  );
}

export default FriendProfile;
