import React, { useState } from 'react';
import { useFriends } from '../context/FriendsContext';
import { useSession } from '../context/SessionContext';
import './InviteSheets.css';

const friendName = (f) => f.friendDisplayName || f.friendUsername;

function useInviteAction(onDone) {
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async (action) => {
    try {
      setBusy(true);
      setError(null);
      await action();
      onDone();
    } catch (err) {
      setError(err.message || 'Could not send the invitation. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return { error, busy, run };
}

// From a session: pick friends who aren't in it yet
export function InviteFriendsSheet({ session, onClose }) {
  const { friends } = useFriends();
  const { inviteFriends } = useSession();
  const [selected, setSelected] = useState([]);
  const { error, busy, run } = useInviteAction(onClose);

  const inSession = new Set(session.participants.map(p => p.userId));
  const available = friends.filter(f => !inSession.has(f.friendUserId));

  const toggle = (id) =>
    setSelected(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal invite-sheet" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="close-button" onClick={onClose} aria-label="Close">✕</button>
        <h2>Invite friends</h2>
        <p className="invite-sheet-subtitle">to read <em>{session.bookTitle}</em> with you</p>

        {available.length === 0 ? (
          <p className="invite-sheet-empty">
            {friends.length === 0
              ? 'Add friends on the Friends tab, then invite them here.'
              : 'All your friends are already in this session.'}
          </p>
        ) : (
          <div className="friend-chips">
            {available.map(friend => (
              <button
                key={friend.friendUserId}
                type="button"
                className={`friend-chip ${selected.includes(friend.friendUserId) ? 'selected' : ''}`}
                onClick={() => toggle(friend.friendUserId)}
                aria-pressed={selected.includes(friend.friendUserId)}
              >
                {friendName(friend)} {selected.includes(friend.friendUserId) && '✓'}
              </button>
            ))}
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            type="button"
            className="btn-primary"
            disabled={busy || selected.length === 0}
            onClick={() => run(() => inviteFriends(session.id, selected))}
          >
            {busy ? 'Inviting…' : selected.length > 1 ? `Invite ${selected.length} friends` : 'Invite'}
          </button>
        </div>
      </div>
    </div>
  );
}

// From a friend's profile: pick one of your sessions to add them to
export function InviteToSessionSheet({ friend, onClose }) {
  const { sessions, inviteFriends } = useSession();
  const [invitedTo, setInvitedTo] = useState(null);
  const { error, busy, run } = useInviteAction(() => {});

  const available = sessions.filter(s => !s.participants.some(p => p.userId === friend.friendUserId));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal invite-sheet" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="close-button" onClick={onClose} aria-label="Close">✕</button>
        <h2>Invite {friendName(friend)}</h2>
        <p className="invite-sheet-subtitle">to one of your reading sessions</p>

        {invitedTo ? (
          <p className="success-message">
            {friendName(friend)} has been invited to read <em>{invitedTo.bookTitle}</em>.
          </p>
        ) : available.length === 0 ? (
          <p className="invite-sheet-empty">
            {sessions.length === 0
              ? 'Start a session from a book in your Library, then invite friends to it.'
              : `${friendName(friend)} is already in all your sessions.`}
          </p>
        ) : (
          <ul className="invite-session-list">
            {available.map(session => (
              <li key={session.id}>
                <button
                  type="button"
                  className="invite-session-option"
                  disabled={busy}
                  onClick={() => run(async () => {
                    await inviteFriends(session.id, [friend.friendUserId]);
                    setInvitedTo(session);
                  })}
                >
                  <span className="invite-session-cover">
                    {session.bookCover ? <img src={session.bookCover} alt="" /> : '📚'}
                  </span>
                  <span className="invite-session-text">
                    <strong>{session.sessionName || session.bookTitle}</strong>
                    <small>{session.participants.length} reader{session.participants.length !== 1 ? 's' : ''}</small>
                  </span>
                  <span className="invite-session-cta">Invite</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && <div className="error-message">{error}</div>}

        <div className="modal-actions invite-sheet-done">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {invitedTo ? 'Done' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}
