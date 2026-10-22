import React, { useState } from 'react';
import { useFriends } from '../context/FriendsContext';
import { recommendBook } from '../utils/socialService';
import { isPreviewMode } from '../utils/previewMode';
import './InviteSheets.css';

const MAX_NOTE = 280;

// Recommend a book to friends, with an optional note. It shows up in their feed.
function RecommendSheet({ book, onClose }) {
  const { friends } = useFriends();
  const [selected, setSelected] = useState([]);
  const [note, setNote] = useState('');
  const [sentTo, setSentTo] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const toggle = (id) =>
    setSelected(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);

  const handleSend = async () => {
    try {
      setBusy(true);
      setError(null);
      if (!isPreviewMode()) {
        await recommendBook(selected, {
          isbn: book.isbn, title: book.title, author: book.author, coverUrl: book.coverUrl
        }, note);
      }
      setSentTo(selected.length);
    } catch (err) {
      setError(err.message || 'Could not send the recommendation. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal invite-sheet" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="close-button" onClick={onClose} aria-label="Close">✕</button>
        <h2>Recommend</h2>
        <p className="invite-sheet-subtitle"><em>{book.title}</em> to friends</p>

        {sentTo ? (
          <p className="success-message">
            Sent to {sentTo} friend{sentTo !== 1 ? 's' : ''}. It'll show up in their feed.
          </p>
        ) : friends.length === 0 ? (
          <p className="invite-sheet-empty">Add friends on the Friends tab to recommend books to them.</p>
        ) : (
          <>
            <div className="friend-chips">
              {friends.map(friend => (
                <button
                  key={friend.friendUserId}
                  type="button"
                  className={`friend-chip ${selected.includes(friend.friendUserId) ? 'selected' : ''}`}
                  onClick={() => toggle(friend.friendUserId)}
                  aria-pressed={selected.includes(friend.friendUserId)}
                >
                  {friend.friendDisplayName || friend.friendUsername} {selected.includes(friend.friendUserId) && '✓'}
                </button>
              ))}
            </div>
            <div className="input-group">
              <label htmlFor="recommend-note">Add a note (optional)</label>
              <textarea
                id="recommend-note"
                className="message-input"
                rows={3}
                maxLength={MAX_NOTE}
                placeholder="Why they'll love it…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </>
        )}

        {error && <div className="error-message">{error}</div>}

        <div className={`modal-actions ${sentTo ? 'invite-sheet-done' : ''}`}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {sentTo ? 'Done' : 'Cancel'}
          </button>
          {!sentTo && friends.length > 0 && (
            <button type="button" className="btn-primary" onClick={handleSend} disabled={busy || selected.length === 0}>
              {busy ? 'Sending…' : 'Send'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default RecommendSheet;
