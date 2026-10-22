import React, { useState } from 'react';
import { useFriends } from '../context/FriendsContext';
import { useSession } from '../context/SessionContext';
import { STATUS_SHELF_NAMES, statusOf } from '../utils/shelves';
import './BookDetail.css';

function BookDetail({ book, customShelves = [], onClose, onStartSession, onUpdateBook, onOpenSession }) {
  const [selectedShelf, setSelectedShelf] = useState(statusOf(book));
  const [onShelves, setOnShelves] = useState(book.shelves || []);
  const [totalChapters, setTotalChapters] = useState(book.totalChapters || '');
  const [totalPages, setTotalPages] = useState(book.totalPages || '');
  const [currentChapter, setCurrentChapter] = useState(book.currentChapter || 0);
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [sessionName, setSessionName] = useState(book.title);
  const [invitedFriends, setInvitedFriends] = useState([]);
  const [trackingMode, setTrackingMode] = useState('chapters');
  const [sessionError, setSessionError] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const { friends } = useFriends();
  const { getSessionForBook } = useSession();
  const existingSession = getSessionForBook(book.isbn);

  const shelves = STATUS_SHELF_NAMES;

  const toggleCustomShelf = (shelfId) => {
    setOnShelves(onShelves.includes(shelfId)
      ? onShelves.filter(id => id !== shelfId)
      : [...onShelves, shelfId]);
  };

  const handleSave = () => {
    const updatedBook = {
      ...book,
      shelf: selectedShelf,
      shelves: onShelves,
      totalChapters: totalChapters ? parseInt(totalChapters) : null,
      totalPages: totalPages ? parseInt(totalPages) : null,
      currentChapter: selectedShelf === 'Currently Reading' ? currentChapter : 0
    };
    
    if (onUpdateBook) {
      onUpdateBook(updatedBook);
    }
    
    onClose();
  };

  // invitedFriends holds friend userIds
  const handleToggleFriend = (friendUserId) => {
    if (invitedFriends.includes(friendUserId)) {
      setInvitedFriends(invitedFriends.filter(id => id !== friendUserId));
    } else {
      setInvitedFriends([...invitedFriends, friendUserId]);
    }
  };

  const handleCreateSession = async () => {
    if (trackingMode === 'chapters' && !parseInt(totalChapters)) {
      setSessionError('Enter the total number of chapters to track by chapter.');
      return;
    }

    if (trackingMode === 'pages' && !parseInt(totalPages)) {
      setSessionError('Enter the total number of pages to track by page.');
      return;
    }

    const updatedBook = {
      ...book,
      shelf: selectedShelf,
      shelves: onShelves,
      totalChapters: parseInt(totalChapters) || null,
      totalPages: parseInt(totalPages) || null,
      currentChapter: selectedShelf === 'Currently Reading' ? currentChapter : 0
    };
    
    if (onUpdateBook) {
      onUpdateBook(updatedBook);
    }

    const sessionData = {
      bookTitle: book.title,
      bookAuthor: book.author,
      bookCover: book.coverUrl,
      bookIsbn: book.isbn,
      totalChapters: totalChapters ? parseInt(totalChapters) : null,
      totalPages: totalPages ? parseInt(totalPages) : null,
      trackingMode: trackingMode,
      sessionName: sessionName,
      participantUserIds: invitedFriends
    };

    try {
      setIsCreating(true);
      setSessionError(null);
      await onStartSession(sessionData);
      onClose();
    } catch (err) {
      setSessionError(err.message || 'Could not start the session. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="book-detail-overlay" onClick={onClose}>
      <div className="book-detail-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>✕</button>
        
        <div className="book-detail-header">
          <div className="book-detail-cover">
            {book.coverUrl ? (
              <img src={book.coverUrl} alt={book.title} />
            ) : (
              <div className="cover-placeholder">📚</div>
            )}
          </div>
          
          <div className="book-detail-info">
            <h2>{book.title}</h2>
            <p className="book-detail-author">{book.author}</p>
            {book.publishYear && (
              <p className="book-detail-year">Published: {book.publishYear}</p>
            )}
          </div>
        </div>

        {book.description && (
          <div className="book-description">
            <h3>Description</h3>
            <p>{book.description.substring(0, 300)}...</p>
          </div>
        )}

        <div className="book-shelf-selector">
          <h3>Reading status</h3>
          <div className="shelf-buttons">
            {shelves.map((shelf) => (
              <button
                key={shelf}
                className={`shelf-button ${selectedShelf === shelf ? 'active' : ''}`}
                onClick={() => setSelectedShelf(shelf)}
              >
                {shelf}
              </button>
            ))}
          </div>

          {customShelves.length > 0 && (
            <div className="book-custom-shelves">
              <span className="book-custom-shelves-label">Also on</span>
              <div className="friend-chips">
                {customShelves.map(shelf => (
                  <button
                    key={shelf.shelfId}
                    type="button"
                    className={`friend-chip ${onShelves.includes(shelf.shelfId) ? 'selected' : ''}`}
                    onClick={() => toggleCustomShelf(shelf.shelfId)}
                    aria-pressed={onShelves.includes(shelf.shelfId)}
                  >
                    {shelf.name} {onShelves.includes(shelf.shelfId) && '✓'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {(selectedShelf === 'Currently Reading' || selectedShelf === 'Finished') && (
          <div className="chapter-input-section">
            <h3>Book Details</h3>
            <div className="input-group">
              <label>Total Chapters (optional):</label>
              <input
                type="number"
                min="1"
                placeholder="e.g., 24"
                value={totalChapters}
                onChange={(e) => setTotalChapters(e.target.value)}
                className="chapter-input"
              />
            </div>

            <div className="input-group">
              <label>Total Pages (optional):</label>
              <input
                type="number"
                min="1"
                placeholder="e.g., 350"
                value={totalPages}
                onChange={(e) => setTotalPages(e.target.value)}
                className="chapter-input"
              />
            </div>
            
            {selectedShelf === 'Currently Reading' && totalChapters && (
              <div className="input-group">
                <label>Current Chapter:</label>
                <input
                  type="number"
                  min="0"
                  max={totalChapters}
                  placeholder="0"
                  value={currentChapter}
                  onChange={(e) => setCurrentChapter(parseInt(e.target.value) || 0)}
                  className="chapter-input"
                />
              </div>
            )}
          </div>
        )}

        {selectedShelf === 'Currently Reading' && totalChapters && currentChapter > 0 && (
          <div className="reading-progress">
            <h3>Reading Progress</h3>
            <p>Chapter {currentChapter} of {totalChapters}</p>
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${(currentChapter / totalChapters) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        {showSessionForm && (
          <div className="session-form-section">
            <h3>Reading Session Setup</h3>
            
            <div className="input-group">
              <label>Track Progress By:</label>
              <div className="tracking-mode-selector">
                <button
                  type="button"
                  className={`tracking-mode-btn ${trackingMode === 'chapters' ? 'active' : ''}`}
                  onClick={() => setTrackingMode('chapters')}
                >
                  📖 Chapters
                </button>
                <button
                  type="button"
                  className={`tracking-mode-btn ${trackingMode === 'pages' ? 'active' : ''}`}
                  onClick={() => setTrackingMode('pages')}
                >
                  📄 Pages
                </button>
              </div>
              <p className="tracking-note">
                Everyone in this session will track progress by {trackingMode}.
              </p>
            </div>

            {/* The total for the chosen mode, so a session can be started from any shelf */}
            {trackingMode === 'chapters' ? (
              <div className="input-group">
                <label>Total Chapters:</label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g., 24"
                  value={totalChapters}
                  onChange={(e) => setTotalChapters(e.target.value)}
                  className="chapter-input"
                />
              </div>
            ) : (
              <div className="input-group">
                <label>Total Pages:</label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g., 350"
                  value={totalPages}
                  onChange={(e) => setTotalPages(e.target.value)}
                  className="chapter-input"
                />
              </div>
            )}

            <div className="input-group">
              <label>Session Name:</label>
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="e.g., Book Club - The Night Circus"
                className="chapter-input"
              />
            </div>

            <div className="input-group">
              <label>Invite Friends:</label>
              {friends.length === 0 ? (
                <p className="tracking-note">Add friends on the Friends tab to read together. You can also start a session on your own.</p>
              ) : (
                <div className="friend-chips">
                  {friends.map(friend => (
                    <button
                      key={friend.friendUserId}
                      type="button"
                      className={`friend-chip ${invitedFriends.includes(friend.friendUserId) ? 'selected' : ''}`}
                      onClick={() => handleToggleFriend(friend.friendUserId)}
                    >
                      {friend.friendDisplayName || friend.friendUsername} {invitedFriends.includes(friend.friendUserId) && '✓'}
                    </button>
                  ))}
                </div>
              )}
              {invitedFriends.length > 0 && (
                <p className="invited-count">{invitedFriends.length} friend(s) invited</p>
              )}
            </div>
          </div>
        )}

        {sessionError && <div className="error-message book-session-error">{sessionError}</div>}

        <div className="book-actions">
          {!showSessionForm ? (
            <>
              <button className="primary-button" onClick={handleSave}>
                💾 Save Changes
              </button>
              {existingSession ? (
                <button
                  className="secondary-button"
                  onClick={onOpenSession}
                >
                  👥 Open session ({existingSession.participants.length} reader{existingSession.participants.length !== 1 ? 's' : ''})
                </button>
              ) : (
                <button
                  className="secondary-button"
                  onClick={() => setShowSessionForm(true)}
                >
                  📖 Start Reading Session
                </button>
              )}
            </>
          ) : (
            <>
              <button 
                className="secondary-button" 
                onClick={() => setShowSessionForm(false)}
              >
                ← Back
              </button>
              <button
                className="primary-button"
                onClick={handleCreateSession}
                disabled={isCreating}
              >
                {isCreating ? 'Starting…' : 'Create Session'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default BookDetail;
