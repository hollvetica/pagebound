import React, { useState, useEffect } from 'react';
import { getMessages, postMessage, markMessageAsRead } from '../utils/sessionsService';
import './Discussion.css';

function Discussion({ session, userId, onClose }) {
  const [visibleMessages, setVisibleMessages] = useState([]);
  const [hiddenMessages, setHiddenMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedChapter, setSelectedChapter] = useState(0);
  const [userCurrentChapter, setUserCurrentChapter] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  // Find user's current chapter from session participants
  useEffect(() => {
    const currentParticipant = session.participants.find(p => p.userId === userId);
    const currentChapter = currentParticipant?.currentChapter || 0;
    setUserCurrentChapter(currentChapter);
    setSelectedChapter(currentChapter); // Default to current chapter
  }, [session, userId]);

  // Load messages
  useEffect(() => {
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.sessionId, userId]);

  const loadMessages = async () => {
    try {
      setIsLoading(true);
      const data = await getMessages(session.sessionId, userId);
      setVisibleMessages(data.visibleMessages || []);
      setHiddenMessages(data.hiddenMessages || []);
      setUserCurrentChapter(data.userCurrentChapter || 0);

      // Mark visible messages as read
      for (const message of data.visibleMessages || []) {
        if (!message.readBy?.[userId]) {
          await markMessageAsRead(session.sessionId, message.messageId, userId);
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) {
      alert('Please enter a message');
      return;
    }

    if (selectedChapter > session.totalChapters) {
      alert(`Chapter must be between 0 and ${session.totalChapters}`);
      return;
    }

    try {
      setIsSending(true);
      await postMessage(session.sessionId, userId, newMessage.trim(), selectedChapter);
      setNewMessage('');
      await loadMessages(); // Reload messages
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="discussion-overlay" onClick={onClose}>
      <div className="discussion-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>✕</button>

        <div className="discussion-header">
          <h2>Discussion</h2>
          <div className="discussion-book-info">
            <h3>{session.bookTitle}</h3>
            <p className="user-progress-indicator">
              You're on Chapter {userCurrentChapter} of {session.totalChapters}
            </p>
          </div>
        </div>

        <div className="discussion-body">
          {isLoading ? (
            <div className="discussion-loading">Loading messages...</div>
          ) : (
            <div className="messages-container">
              {visibleMessages.length === 0 && hiddenMessages.length === 0 ? (
                <div className="no-messages">
                  <div className="no-messages-icon">💬</div>
                  <p>No messages yet</p>
                  <p className="no-messages-hint">Start the discussion!</p>
                </div>
              ) : (
                <>
                  {/* Visible messages */}
                  {visibleMessages.map((message) => (
                    <div
                      key={message.messageId}
                      className={`message-item ${message.userId === userId ? 'own-message' : ''}`}
                    >
                      <div className="message-avatar">
                        {message.avatarUrl ? (
                          <img src={message.avatarUrl} alt={message.displayName} />
                        ) : (
                          <div className="avatar-placeholder">
                            {message.displayName?.charAt(0).toUpperCase() || '?'}
                          </div>
                        )}
                      </div>
                      <div className="message-content">
                        <div className="message-header">
                          <span className="message-author">{message.displayName}</span>
                          <span className="message-chapter-tag">Ch. {message.chapterNumber}</span>
                          <span className="message-timestamp">{formatTimestamp(message.createdAt)}</span>
                        </div>
                        <p className="message-text">{message.message}</p>
                      </div>
                    </div>
                  ))}

                  {/* Hidden message placeholders */}
                  {hiddenMessages.map((hiddenMsg) => (
                    <div key={hiddenMsg.messageId} className="hidden-message-placeholder">
                      <div className="speech-bubble-icon">
                        <span className="bubble-chapter-number">{hiddenMsg.chapterNumber}</span>
                      </div>
                      <p className="hidden-message-text">
                        Message waiting at Chapter {hiddenMsg.chapterNumber}
                      </p>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        <div className="discussion-footer">
          <div className="message-input-section">
            <textarea
              className="message-input"
              placeholder="Type your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              rows={3}
              disabled={isSending}
            />
            <div className="message-controls">
              <div className="chapter-selector">
                <label htmlFor="chapter-select">Chapter:</label>
                <select
                  id="chapter-select"
                  value={selectedChapter}
                  onChange={(e) => setSelectedChapter(parseInt(e.target.value))}
                  disabled={isSending}
                >
                  {Array.from({ length: session.totalChapters + 1 }, (_, i) => (
                    <option key={i} value={i}>
                      {i === 0 ? 'General' : `Chapter ${i}`}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="send-message-btn"
                onClick={handleSendMessage}
                disabled={isSending || !newMessage.trim()}
              >
                {isSending ? 'Sending...' : '📤 Send'}
              </button>
            </div>
            <p className="chapter-hint">
              Messages are only visible to readers who have reached the selected chapter
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Discussion;
