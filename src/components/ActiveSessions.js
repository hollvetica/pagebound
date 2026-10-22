import React from 'react';
import './ActiveSessions.css';

function ActiveSessions({ sessions }) {
  if (!sessions || sessions.length === 0) {
    return null;
  }

  // The signed-in reader's own position, in the session's unit
  const myProgress = (session) => {
    const byPages = session.trackingMode === 'pages';
    const me = session.participants.find(p => p.isMe) || session.participants.find(p => p.isHost);
    const current = (byPages ? me?.currentPage : me?.currentChapter) || 0;
    const total = (byPages ? session.totalPages : session.totalChapters) || 0;
    return {
      label: `${byPages ? 'Page' : 'Chapter'} ${current} of ${total}`,
      percent: total ? Math.min(100, Math.round((current / total) * 100)) : 0
    };
  };

  return (
    <div className="active-sessions-section">
      <h3>Active Reading Sessions</h3>
      <div className="sessions-list">
        {sessions.map((session) => {
          const progress = myProgress(session);
          const progressPercent = progress.percent;
          const others = session.participants.filter(p => !p.isMe).map(p => p.name);

          return (
            <div key={session.id} className="session-card">
              <div className="session-header">
                <div className="session-book-cover">
                  {session.bookCover ? (
                    <img src={session.bookCover} alt={session.bookTitle} />
                  ) : (
                    <div className="cover-placeholder">📚</div>
                  )}
                </div>
                <div className="session-info">
                  <h4>{session.bookTitle}</h4>
                  <p className="session-author">{session.bookAuthor}</p>
                  <p className="session-chapter">{progress.label}</p>
                </div>
              </div>

              <div className="session-progress">
                <div className="progress-bar-container">
                  <div 
                    className="progress-bar-fill" 
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="progress-text">{progressPercent}% complete</span>
              </div>

              <div className="session-participants">
                <span className="participants-icon">👥</span>
                <span>{others.length ? `Reading with ${others.join(', ')}` : 'Reading solo'}</span>
              </div>

              <div className="session-time">
                <span className="time-icon">🕐</span>
                <span>{new Date(session.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ActiveSessions;