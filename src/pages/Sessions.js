import React, { useState } from 'react';
import { useSession } from '../context/SessionContext';
import { useAuth } from '../context/AuthContext';
import UpdateProgress from '../components/UpdateProgress';
import Discussion from '../components/Discussion';
import ParticipantTimeline from '../components/ParticipantTimeline';
import { InviteFriendsSheet } from '../components/InviteSheets';
import { Lock, MessageCircle, UserPlus } from 'lucide-react';
import './Sessions.css';

function Sessions() {
  const { sessions, updateMyProgress, refreshSessions, markSeen, deleteSession, leaveSession } = useSession();
  const { userProfile } = useAuth();
  const [showUpdateProgress, setShowUpdateProgress] = useState(false);
  const [showDiscussion, setShowDiscussion] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [invitingTo, setInvitingTo] = useState(null);
  const [actionError, setActionError] = useState(null);

  const handleUpdateProgress = (session) => {
    setSelectedSession(session);
    setShowUpdateProgress(true);
  };

  // The discussion gets the session as it was (so it can highlight what's new),
  // then the badge clears
  const handleOpenDiscussion = (session) => {
    setSelectedSession(session);
    setShowDiscussion(true);
    if (session.newCount) markSeen(session.id);
  };

  const handleLeaveOrDelete = async (session, isHost) => {
    const question = isHost
      ? `Delete "${session.sessionName || session.bookTitle}" for everyone? Comments and progress will be removed.`
      : `Leave "${session.sessionName || session.bookTitle}"? You can start your own session for this book afterwards.`;
    if (!window.confirm(question)) return;
    try {
      setActionError(null);
      if (isHost) await deleteSession(session.id);
      else await leaveSession(session.id);
    } catch (err) {
      setActionError(err.message || 'Something went wrong. Please try again.');
    }
  };

  // progress: { currentChapter, currentPage } for the signed-in reader
  const handleSaveProgress = async (sessionId, progress) => {
    await updateMyProgress(sessionId, progress);
  };

  const calculateGroupRating = (session) => {
    // Mock data - will be replaced with actual user ratings from bookshelf
    // This would fetch ratings from each participant's Library for this book
    const mockRatings = [4.5, 5, 4, 4.5]; // Would come from userProfile bookshelf ratings
    if (mockRatings.length === 0) return null;
    const avgRating = mockRatings.reduce((sum, r) => sum + r, 0) / mockRatings.length;
    return avgRating.toFixed(1);
  };

  return (
    <div className="page sessions-page">
      <div className="sessions-header">
        <h2>Reading Sessions</h2>
        <p className="session-count">{sessions.length} active session{sessions.length !== 1 ? 's' : ''}</p>
      </div>

      {actionError && <div className="error-message sessions-action-error">{actionError}</div>}

      {sessions.length === 0 ? (
        <div className="no-sessions-state">
          <div className="empty-icon">📚</div>
          <h3>No Active Sessions</h3>
          <p>Start a reading session from your library to read with friends!</p>
        </div>
      ) : (
        <div className="sessions-grid">
          {sessions.map((session) => {
            const groupRating = calculateGroupRating(session);
            const me = session.participants.find(p => p.isMe);
            const isHost = !!me?.isHost;
            const unit = session.trackingMode === 'pages' ? 'page' : 'chapter';

            return (
              <div key={session.id} className="session-detail-card">
                <div className="session-card-header">
                  <div className="session-book-cover-large">
                    {session.bookCover ? (
                      <img src={session.bookCover} alt={session.bookTitle} />
                    ) : (
                      <div className="cover-placeholder-large">📚</div>
                    )}
                  </div>

                  <div className="session-card-info">
                    <h3>{session.sessionName || session.bookTitle}</h3>
                    <p className="session-book-author">{session.bookAuthor}</p>
                    {groupRating && (
                      <div className="group-rating">
                        <span className="rating-stars">⭐</span>
                        <span className="rating-value">{groupRating}</span>
                        <span className="rating-label">Group Rating</span>
                      </div>
                    )}
                    <div className="session-meta">
                      <span className="meta-item">
                        📖 {session.trackingMode === 'pages'
                          ? `${session.totalPages} pages`
                          : `${session.totalChapters} chapters`}
                      </span>
                      <span className="meta-item">
                        👥 {session.participants.length} reader{session.participants.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {(session.isNewInvite || session.newMessageCount > 0 || session.waitingCount > 0) && (
                      <div className="session-status-pills">
                        {session.isNewInvite && (
                          <span className="session-pill is-new">New invitation</span>
                        )}
                        {session.newMessageCount > 0 && (
                          <span className="session-pill is-new">
                            <MessageCircle size={12} aria-hidden="true" />
                            {session.newMessageCount} new comment{session.newMessageCount !== 1 ? 's' : ''}
                          </span>
                        )}
                        {session.waitingCount > 0 && (
                          <span className="session-pill" title={`Unlocks as you read further`}>
                            <Lock size={12} aria-hidden="true" />
                            {session.waitingCount} waiting ahead
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="participants-section">
                  <h4>Participants</h4>
                  <div className="participants-list">
                    {session.participants.map((participant, idx) => (
                      <ParticipantTimeline
                        key={idx}
                        participant={participant}
                        session={session}
                        currentUserId={userProfile?.userId}
                      />
                    ))}
                  </div>
                </div>

                <div className="session-actions-section">
                  <button
                    className="session-action-btn primary"
                    onClick={() => handleOpenDiscussion(session)}
                  >
                    💬 Discussion
                    {session.newMessageCount > 0 && (
                      <span className="session-action-count">{session.newMessageCount}</span>
                    )}
                  </button>
                  <button
                    className="session-action-btn secondary"
                    onClick={() => handleUpdateProgress(session)}
                  >
                    📊 Update Progress
                  </button>
                </div>

                <div className="session-footer">
                  <span className="session-created">
                    Started {new Date(session.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · by {unit}
                  </span>
                  <div className="session-footer-actions">
                    <button className="btn-ghost btn-sm" onClick={() => setInvitingTo(session)}>
                      <UserPlus size={14} /> Invite
                    </button>
                    <button className="btn-ghost btn-sm session-leave" onClick={() => handleLeaveOrDelete(session, isHost)}>
                      {isHost ? 'Delete' : 'Leave'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {invitingTo && (
        <InviteFriendsSheet session={invitingTo} onClose={() => setInvitingTo(null)} />
      )}

      {showUpdateProgress && selectedSession && (
        <UpdateProgress
          session={selectedSession}
          onClose={() => {
            setShowUpdateProgress(false);
            setSelectedSession(null);
          }}
          onUpdateProgress={handleSaveProgress}
        />
      )}

      {showDiscussion && selectedSession && userProfile && (
        <Discussion
          session={selectedSession}
          userId={userProfile.userId}
          onClose={() => {
            setShowDiscussion(false);
            setSelectedSession(null);
            refreshSessions(); // clears unread counts for what was just read
          }}
        />
      )}
    </div>
  );
}

export default Sessions;
