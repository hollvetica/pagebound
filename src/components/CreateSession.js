import React, { useState } from 'react';
import './CreateSession.css';

function CreateSession({ book, onClose, onCreateSession }) {
  const [sessionName, setSessionName] = useState(book.title);
  const [invitedFriends, setInvitedFriends] = useState([]);
  const [friendInput, setFriendInput] = useState('');
  
  // Mock friends list - in real app, this would come from user's friends
  const mockFriends = ['Sarah', 'Alex', 'Maya', 'Jordan', 'Riley'];

  const handleAddFriend = (friendName) => {
    if (!invitedFriends.includes(friendName)) {
      setInvitedFriends([...invitedFriends, friendName]);
    }
  };

  const handleRemoveFriend = (friendName) => {
    setInvitedFriends(invitedFriends.filter(f => f !== friendName));
  };

  const handleCreate = () => {
    if (!book.totalChapters) {
      alert('Please set total chapters for this book first!');
      return;
    }

    const newSession = {
      id: Date.now().toString(),
      bookTitle: book.title,
      bookAuthor: book.author,
      bookCover: book.coverUrl,
      bookIsbn: book.isbn,
      totalChapters: book.totalChapters,
      sessionName: sessionName,
      createdAt: new Date().toISOString(),
      participants: [
        {
          name: 'You',
          currentChapter: book.currentChapter || 0,
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
    onClose();
  };

  return (
    <div className="create-session-overlay" onClick={onClose}>
      <div className="create-session-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>✕</button>
        
        <h2>Start Reading Session</h2>
        
        <div className="session-book-info">
          <div className="session-book-cover">
            {book.coverUrl ? (
              <img src={book.coverUrl} alt={book.title} />
            ) : (
              <div className="cover-placeholder">📚</div>
            )}
          </div>
          <div>
            <h3>{book.title}</h3>
            <p>{book.author}</p>
            {book.totalChapters && (
              <p className="chapter-count">{book.totalChapters} chapters</p>
            )}
          </div>
        </div>

        {!book.totalChapters && (
          <div className="warning-message">
            ⚠️ Please add total chapters to this book before creating a session
          </div>
        )}

        <div className="input-group">
          <label>Session Name</label>
          <input
            type="text"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            placeholder="e.g., Book Club - The Night Circus"
            className="session-input"
          />
        </div>

        <div className="invite-section">
          <label>Invite Friends</label>
          <div className="friend-suggestions">
            {mockFriends.map(friend => (
              <button
                key={friend}
                className={`friend-chip ${invitedFriends.includes(friend) ? 'selected' : ''}`}
                onClick={() => invitedFriends.includes(friend) 
                  ? handleRemoveFriend(friend) 
                  : handleAddFriend(friend)
                }
              >
                {friend} {invitedFriends.includes(friend) && '✓'}
              </button>
            ))}
          </div>
          
          {invitedFriends.length > 0 && (
            <div className="invited-list">
              <p className="invited-count">{invitedFriends.length} friend(s) invited</p>
            </div>
          )}
        </div>

        <div className="session-info">
          <h4>Session Features:</h4>
          <ul>
            <li>📖 Track reading progress together</li>
            <li>💬 Discuss without spoilers</li>
            <li>🎯 See who's ahead or behind</li>
            <li>🏆 Challenge friends to catch up</li>
          </ul>
        </div>

        <div className="session-actions">
          <button className="cancel-button" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="create-button" 
            onClick={handleCreate}
            disabled={!book.totalChapters}
          >
            Create Session
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateSession;
