import React from 'react';
import './ActiveSessions.css';

function ActiveSessions({ sessions }) {
  if (!sessions || sessions.length === 0) {
    return null;
  }

  const calculateAverageProgress = (participants) => {
    const avgChapter = participants.reduce((sum, p) => sum + p.currentChapter, 0) / participants.length;
    return Math.round(avgChapter);
  };

  return (
    <div className="active-sessions-section">
      <h3>Active Reading Sessions</h3>
      <div className="sessions-list">
        {sessions.map((session) => {
          const avgProgress = calculateAverageProgress(session.participants);
          const progressPercent = session.totalChapters 
            ? Math.round((avgProgress / session.totalChapters) * 100)
            : 0;

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
                  <p className="session-chapter">Chapter {avgProgress} of {session.totalChapters}</p>
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
                <span>Reading with {session.participants.filter(p => !p.isHost).map(p => p.name).join(', ')}</span>
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