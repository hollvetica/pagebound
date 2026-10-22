import React, { useState } from 'react';
import { useSession } from '../context/SessionContext';
import { useAuth } from '../context/AuthContext';
import UpdateProgress from '../components/UpdateProgress';
import Discussion from '../components/Discussion';
import ParticipantTimeline from '../components/ParticipantTimeline';
import './Sessions.css';

function Sessions() {
  const { sessions, updateMyProgress, refreshSessions } = useSession();
  const { userProfile } = useAuth();
  const [showUpdateProgress, setShowUpdateProgress] = useState(false);
  const [showDiscussion, setShowDiscussion] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);

  const handleUpdateProgress = (session) => {
    setSelectedSession(session);
    setShowUpdateProgress(true);
  };

  const handleOpenDiscussion = (session) => {
    setSelectedSession(session);
    setShowDiscussion(true);
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
                    💬 Open Discussion
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
                    Started {new Date(session.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
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
