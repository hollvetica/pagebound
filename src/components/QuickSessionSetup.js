import React, { useState } from 'react';
import { useFriends } from '../context/FriendsContext';
import './QuickSessionSetup.css';

// Start a session from a friend's activity on Home. The friend from the
// activity is pre-selected when they're in the friends list.
function QuickSessionSetup({ activity, onClose, onCreateSession }) {
  const { friends } = useFriends();
  const activityFriend = friends.find(f =>
    [f.friendDisplayName, f.friendUsername].includes(activity.friend)
  );

  const [sessionName, setSessionName] = useState(`Reading ${activity.book} together`);
  const [totalChapters, setTotalChapters] = useState('');
  const [invitedFriends, setInvitedFriends] = useState(activityFriend ? [activityFriend.friendUserId] : []);
  const [error, setError] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  const friendName = (f) => f.friendDisplayName || f.friendUsername;

  const handleToggleFriend = (friendUserId) => {
    setInvitedFriends(invitedFriends.includes(friendUserId)
      ? invitedFriends.filter(id => id !== friendUserId)
      : [...invitedFriends, friendUserId]);
  };

  const handleCreate = async () => {
    if (!parseInt(totalChapters, 10)) {
      setError('Enter how many chapters the book has.');
      return;
    }

    try {
      setIsCreating(true);
      setError(null);
      await onCreateSession({
        bookTitle: activity.book,
        bookAuthor: activity.bookAuthor || '',
        bookCover: activity.bookCover || null,
        bookIsbn: activity.bookIsbn,
        totalChapters: parseInt(totalChapters, 10),
        trackingMode: 'chapters',
        sessionName,
        participantUserIds: invitedFriends
      });
    } catch (err) {
      setError(err.message || 'Could not start the session. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="quick-setup-overlay" onClick={onClose}>
      <div className="quick-setup-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>✕</button>

        <h2>Start Reading Together</h2>

        <div className="quick-setup-book">
          <p className="book-title">{activity.book}</p>
          <p className="suggestion-text">
            {activity.friend} wants to read this too!
          </p>
        </div>

        <div className="input-group">
          <label>Session Name:</label>
          <input
            type="text"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            className="session-input"
          />
        </div>

        <div className="input-group">
          <label>Total Chapters:</label>
          <input
            type="number"
            min="1"
            placeholder="e.g., 24"
            value={totalChapters}
            onChange={(e) => setTotalChapters(e.target.value)}
            className="session-input"
          />
        </div>

        <div className="invited-section">
          <label>Reading with:</label>
          {friends.length === 0 ? (
            <p className="suggestion-text">Add friends on the Friends tab to invite them.</p>
          ) : (
            <div className="friend-chips">
              {friends.map(friend => (
                <button
                  key={friend.friendUserId}
                  className={`friend-chip ${invitedFriends.includes(friend.friendUserId) ? 'selected' : ''}`}
                  onClick={() => handleToggleFriend(friend.friendUserId)}
                >
                  {friendName(friend)} {invitedFriends.includes(friend.friendUserId) && '✓'}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="quick-setup-actions">
          <button className="cancel-button" onClick={onClose}>
            Cancel
          </button>
          <button className="create-button" onClick={handleCreate} disabled={isCreating}>
            {isCreating ? 'Starting…' : 'Create Session'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default QuickSessionSetup;
