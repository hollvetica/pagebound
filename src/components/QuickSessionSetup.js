import React, { useState } from 'react';
import './QuickSessionSetup.css';

function QuickSessionSetup({ activity, onClose, onCreateSession }) {
  const [sessionName, setSessionName] = useState(`Reading ${activity.book} together`);
  const [addMoreFriends, setAddMoreFriends] = useState(false);
  const [invitedFriends, setInvitedFriends] = useState([activity.friend]);
  
  const mockFriends = ['Sarah', 'Alex', 'Maya', 'Jordan', 'Riley'].filter(f => f !== activity.friend);

  const handleToggleFriend = (friendName) => {
    if (invitedFriends.includes(friendName)) {
      setInvitedFriends(invitedFriends.filter(f => f !== friendName));
    } else {
      setInvitedFriends([...invitedFriends, friendName]);
    }
  };

  const handleCreate = () => {
    // In a real app, we'd fetch book details from the ISBN
    // For now, create with basic info
    const newSession = {
      id: Date.now().toString(),
      bookTitle: activity.book,
      bookAuthor: 'Unknown', // Would come from book lookup
      bookCover: null,
      bookIsbn: activity.bookIsbn,
      totalChapters: 20, // Default - user can update later
      sessionName: sessionName,
      createdAt: new Date().toISOString(),
      participants: [
        {
          name: 'You',
          currentChapter: 0,
          isHost: true
        },
        ...invitedFriends.map(friend => ({
          name: friend,
          currentChapter: 0,
          isHost: false
        }))
      ]
    };

    onCreateSession(newSession);
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

        <div className="invited-section">
          <label>Reading with:</label>
          <div className="invited-list">
            {invitedFriends.map(friend => (
              <span key={friend} className="invited-chip">
                {friend}
                {friend !== activity.friend && (
                  <button onClick={() => handleToggleFriend(friend)}>✕</button>
                )}
              </span>
            ))}
          </div>
          
          {!addMoreFriends && (
            <button 
              className="add-more-btn"
              onClick={() => setAddMoreFriends(true)}
            >
              + Invite more friends
            </button>
          )}
          
          {addMoreFriends && (
            <div className="friend-chips">
              {mockFriends.map(friend => (
                <button
                  key={friend}
                  className={`friend-chip ${invitedFriends.includes(friend) ? 'selected' : ''}`}
                  onClick={() => handleToggleFriend(friend)}
                >
                  {friend} {invitedFriends.includes(friend) && '✓'}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="quick-setup-actions">
          <button className="cancel-button" onClick={onClose}>
            Cancel
          </button>
          <button className="create-button" onClick={handleCreate}>
            Create Session
          </button>
        </div>
      </div>
    </div>
  );
}

export default QuickSessionSetup;
