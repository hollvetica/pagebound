import React from 'react';
import './ActiveSessions.css';

function ActiveSessions({ sessions }) {
  if (sessions.length === 0) {
    return (
      <div className="active-sessions">
        <h3>Active Reading Sessions</h3>
        <p className="no-sessions">No active sessions. Start reading with friends!</p>
      </div>
    );
  }

  return (
    <div className="active-sessions">
      <h3>Active Reading Sessions</h3>
      <div className="sessions-list">
        {sessions.map((session) => (
          <div key={session.id} className="session-card">
            <div className="session-header">
              <h4>{session.book.title}</h4>
              <p className="author">{session.book.author}</p>
            </div>
            
            <div className="session-progress">
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${(session.currentChapter / session.totalChapters) * 100}%` }}
                ></div>
              </div>
              <p className="progress-text">
                Chapter {session.currentChapter} of {session.totalChapters}
              </p>
            </div>

            <div className="session-friends">
              <span className="friends-icon">👥</span>
              <p>Reading with {session.friends.join(', ')}</p>
            </div>

            <p className="last-activity">{session.lastActivity}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ActiveSessions;