import React, { useState, useEffect, useCallback } from 'react';
import { getMessages, postMessage, markMessageAsRead } from '../utils/sessionsService';
import { Lock } from 'lucide-react';
import { isPreviewMode } from '../utils/previewMode';
import './Discussion.css';

const REFRESH_MS = 15000;

// Spoiler-free session discussion. Comments are tagged to a chapter or page
// (whatever the session tracks). The server only sends the text of comments
// the reader has reached; the rest arrive as position-only placeholders.
function Discussion({ session, userId, onClose }) {
  const byPages = session.trackingMode === 'pages';
  const unit = byPages ? 'page' : 'chapter';
  const total = (byPages ? session.totalPages : session.totalChapters) || 0;

  const me = session.participants.find(p => p.isMe || p.userId === userId);
  const startPosition = (byPages ? me?.currentPage : me?.currentChapter) || 0;
  // When the reader last caught up – comments after this are marked New.
  // Captured once so the markers stay while the sheet is open.
  const [seenBefore] = useState(session.isNewInvite ? null : session.lastSeenAt || null);

  const [visibleMessages, setVisibleMessages] = useState([]);
  const [hiddenMessages, setHiddenMessages] = useState([]);
  const [userPosition, setUserPosition] = useState(startPosition);
  const [newMessage, setNewMessage] = useState('');
  const [selectedPosition, setSelectedPosition] = useState(startPosition);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);

  const loadMessages = useCallback(async ({ silent = false } = {}) => {
    if (isPreviewMode()) {
      // Sample comments for UI preview: localStorage pagebound-preview-messages-<sessionId>
      const sample = JSON.parse(localStorage.getItem(`pagebound-preview-messages-${session.sessionId}`) || 'null');
      if (sample) {
        setVisibleMessages(sample.visibleMessages || []);
        setHiddenMessages(sample.hiddenMessages || []);
        setUserPosition(sample.userPosition ?? startPosition);
      }
      setIsLoading(false);
      return;
    }
    try {
      const data = await getMessages(session.sessionId);
      setVisibleMessages(data.visibleMessages || []);
      setHiddenMessages(data.hiddenMessages || []);
      setUserPosition(data.userPosition ?? data.userCurrentChapter ?? 0);
      setError(null);

      // Mark what the reader can now see as read
      const unread = (data.visibleMessages || []).filter(m => !m.readBy?.[userId]);
      await Promise.all(unread.map(m => markMessageAsRead(session.sessionId, m.messageId).catch(() => {})));
    } catch (err) {
      console.error('Error loading messages:', err);
      if (!silent) setError('Could not load the discussion.');
    } finally {
      setIsLoading(false);
    }
  }, [session.sessionId, userId, startPosition]);

  // Load now, then keep up with the conversation while the sheet is open
  useEffect(() => {
    loadMessages();
    const interval = setInterval(() => loadMessages({ silent: true }), REFRESH_MS);
    return () => clearInterval(interval);
  }, [loadMessages]);

  const handleSendMessage = async () => {
    const text = newMessage.trim();
    if (!text) return;
    if (selectedPosition < 0 || (total && selectedPosition > total)) {
      setError(`Pick a ${unit} between 0 and ${total}.`);
      return;
    }

    try {
      setIsSending(true);
      setError(null);
      await postMessage(session.sessionId, text, selectedPosition);
      setNewMessage('');
      await loadMessages();
    } catch (err) {
      console.error('Error sending message:', err);
      setError(err.message || 'Could not send your comment.');
    } finally {
      setIsSending(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const diffMins = Math.floor((Date.now() - date) / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    if (diffMins < 10080) return `${Math.floor(diffMins / 1440)}d ago`;
    return date.toLocaleDateString();
  };

  const positionLabel = (position) => (position === 0 ? 'General' : `${byPages ? 'p.' : 'Ch.'} ${position}`);
  const byTime = (a, b) => (a.createdAt || '').localeCompare(b.createdAt || '');
  const isNew = (m) => m.userId !== userId && (!seenBefore || m.createdAt > seenBefore);

  // Locked comments grouped by where they unlock
  const waiting = Object.entries(
    hiddenMessages.reduce((acc, m) => {
      const position = m.position ?? m.chapterNumber;
      acc[position] = (acc[position] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([position, count]) => ({ position: parseInt(position, 10), count }))
    .sort((a, b) => a.position - b.position);
  const toGo = (position) => {
    const n = position - userPosition;
    return `${n} ${unit}${n !== 1 ? 's' : ''} to go`;
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
              You're on {unit} {userPosition} of {total}
            </p>
          </div>
        </div>

        <div className="discussion-body">
          {isLoading ? (
            <div className="discussion-loading">Loading comments…</div>
          ) : (
            <div className="messages-container">
              {visibleMessages.length === 0 && hiddenMessages.length === 0 ? (
                <div className="no-messages">
                  <div className="no-messages-icon">💬</div>
                  <p>No comments yet</p>
                  <p className="no-messages-hint">Leave a note for your fellow readers.</p>
                </div>
              ) : (
                <>
                  {[...visibleMessages].sort(byTime).map((message) => (
                    <div
                      key={message.messageId}
                      className={`message-item ${message.userId === userId ? 'own-message' : ''} ${isNew(message) ? 'is-new' : ''}`}
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
                          <span className="message-author">{message.userId === userId ? 'You' : message.displayName}</span>
                          <span className="message-chapter-tag">{positionLabel(message.position ?? message.chapterNumber)}</span>
                          <span className="message-timestamp">{formatTimestamp(message.createdAt)}</span>
                          {isNew(message) && <span className="message-new-tag">New</span>}
                        </div>
                        <p className="message-text">{message.message}</p>
                      </div>
                    </div>
                  ))}

                  {/* Comments ahead of the reader: where and how many, never what */}
                  {waiting.length > 0 && (
                    <div className="waiting-ahead">
                      <p className="waiting-ahead-title">Waiting for you ahead</p>
                      {waiting.map(({ position, count }) => (
                        <div key={position} className="hidden-message-placeholder">
                          <div className="speech-bubble-icon">
                            <Lock size={14} aria-hidden="true" />
                          </div>
                          <div className="hidden-message-body">
                            <p className="hidden-message-text">
                              {count} comment{count !== 1 ? 's' : ''} · Available after {unit} {position}
                            </p>
                            <p className="hidden-message-meta">{toGo(position)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="discussion-footer">
          <div className="message-input-section">
            {error && <div className="error-message">{error}</div>}
            <textarea
              className="message-input"
              placeholder="Share a thought…"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              rows={3}
              maxLength={2000}
              disabled={isSending}
            />
            <div className="message-controls">
              <div className="chapter-selector">
                <label htmlFor="position-select">{byPages ? 'Page:' : 'Chapter:'}</label>
                {byPages ? (
                  <input
                    id="position-select"
                    className="chapter-input"
                    type="number"
                    min="0"
                    max={total || undefined}
                    value={selectedPosition}
                    onChange={(e) => setSelectedPosition(parseInt(e.target.value, 10) || 0)}
                    disabled={isSending}
                  />
                ) : (
                  <select
                    id="position-select"
                    value={selectedPosition}
                    onChange={(e) => setSelectedPosition(parseInt(e.target.value, 10))}
                    disabled={isSending}
                  >
                    {Array.from({ length: total + 1 }, (_, i) => (
                      <option key={i} value={i}>
                        {i === 0 ? 'General' : `Chapter ${i}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <button
                className="send-message-btn"
                onClick={handleSendMessage}
                disabled={isSending || !newMessage.trim()}
              >
                {isSending ? 'Sending…' : 'Send'}
              </button>
            </div>
            <p className="chapter-hint">
              Readers only see this once they've finished {unit} {selectedPosition || 0}.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Discussion;
