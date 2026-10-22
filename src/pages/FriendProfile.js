import React, { useState, useEffect } from 'react';
import { useFriends } from '../context/FriendsContext';
import { User, Users, BookOpen, UserPlus, UserMinus } from 'lucide-react';
import { InviteToSessionSheet } from '../components/InviteSheets';
import { useSession } from '../context/SessionContext';
import { getFriendLibrary } from '../utils/libraryService';
import { isPreviewMode } from '../utils/previewMode';
import './FriendProfile.css';

function FriendProfile({ friendUserId, onNavigate }) {
  const { getFriendByUserId, removeFriend } = useFriends();
  const { sessions } = useSession();
  const [friend, setFriend] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [library, setLibrary] = useState(null); // { isPrivate, shelves } once loaded

  // Their public shelves
  useEffect(() => {
    if (!friendUserId) return undefined;
    let cancelled = false;
    if (isPreviewMode()) {
      setLibrary(JSON.parse(localStorage.getItem('pagebound-preview-friend-library') || '{"isPrivate":false,"shelves":[]}'));
      return undefined;
    }
    getFriendLibrary(friendUserId)
      .then(data => { if (!cancelled) setLibrary(data); })
      .catch(() => { if (!cancelled) setLibrary({ isPrivate: false, shelves: [], failed: true }); });
    return () => { cancelled = true; };
  }, [friendUserId]);

  // Sessions you're both in
  const shared = sessions.filter(s => s.participants.some(p => p.userId === friendUserId));
  const positionIn = (session, participant) => {
    const byPages = session.trackingMode === 'pages';
    const value = (byPages ? participant?.currentPage : participant?.currentChapter) || 0;
    return `${byPages ? 'p.' : 'ch.'} ${value}`;
  };

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
        <button className="profile-action-btn primary" onClick={() => setShowInvite(true)}>
          <UserPlus size={18} />
          Invite to a session
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
            {!library ? (
              <p className="friend-shelves-loading">Loading shelves…</p>
            ) : library.shelves.length === 0 ? (
              <div className="friend-bookshelves">
                <div className="empty-state">
                  <BookOpen size={48} />
                  <p>{library.failed ? "Couldn't load their shelves" : 'No public bookshelves yet'}</p>
                  <p className="empty-hint">
                    {library.failed
                      ? 'Please try again in a moment.'
                      : `${friend.friendDisplayName} hasn't put books on a public shelf yet`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="friend-shelves">
                {library.shelves.map(shelf => (
                  <div key={shelf.shelfId} className="friend-shelf">
                    <p className="friend-shelf-name">
                      {shelf.name} <span>{shelf.books.length}</span>
                    </p>
                    <div className="friend-shelf-row">
                      {shelf.books.map(book => (
                        <div key={book.isbn} className="friend-shelf-book" title={`${book.title}${book.author ? ` · ${book.author}` : ''}`}>
                          <div className="friend-shelf-cover">
                            {book.coverUrl ? <img src={book.coverUrl} alt="" /> : '📚'}
                          </div>
                          <p>{book.title}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="friend-profile-section">
            <h3>
              <Users size={18} />
              Shared Sessions
            </h3>
            {shared.length === 0 ? (
              <div className="friend-sessions">
                <div className="empty-state">
                  <Users size={48} />
                  <p>No shared reading sessions</p>
                  <p className="empty-hint">
                    Invite {friend.friendDisplayName} to a session to read together
                  </p>
                </div>
              </div>
            ) : (
              <ul className="friend-shared-sessions">
                {shared.map(session => {
                  const me = session.participants.find(p => p.isMe);
                  const them = session.participants.find(p => p.userId === friendUserId);
                  return (
                    <li key={session.id}>
                      <button type="button" onClick={() => onNavigate && onNavigate('sessions')}>
                        <span className="friend-shared-cover">
                          {session.bookCover ? <img src={session.bookCover} alt="" /> : '📚'}
                        </span>
                        <span className="friend-shared-text">
                          <strong>{session.sessionName || session.bookTitle}</strong>
                          <small>You: {positionIn(session, me)} · {friend.friendDisplayName}: {positionIn(session, them)}</small>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      ) : (
        <div className="friend-profile-private-notice">
          <User size={48} />
          <h3>Private Profile</h3>
          <p>This user has a private profile. You can still invite them to read together!</p>
        </div>
      )}

      {showInvite && (
        <InviteToSessionSheet friend={friend} onClose={() => setShowInvite(false)} />
      )}
    </div>
  );
}

export default FriendProfile;
