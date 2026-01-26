import React, { useState } from 'react';
import { useSession } from '../context/SessionContext';
import UpdateProgress from '../components/UpdateProgress';
import './Sessions.css';

function Sessions() {
  const { sessions, updateParticipantProgress } = useSession();
  const [showUpdateProgress, setShowUpdateProgress] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);

  const handleUpdateProgress = (session) => {
    setSelectedSession(session);
    setShowUpdateProgress(true);
  };

  const handleSaveProgress = (sessionId, participantName, newChapter) => {
    updateParticipantProgress(sessionId, participantName, newChapter);
  };

  const calculateAverageProgress = (participants) => {
    if (participants.length === 0) return 0;
    const avgChapter = participants.reduce((sum, p) => sum + p.currentChapter, 0) / participants.length;
    return Math.round(avgChapter);
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
            const avgProgress = calculateAverageProgress(session.participants);
            const progressPercent = session.totalChapters 
              ? Math.round((avgProgress / session.totalChapters) * 100)
              : 0;
            const userProgress = session.participants.find(p => p.isHost)?.currentChapter || 0;

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
                    <div className="session-meta">
                      <span className="meta-item">
                        📖 {session.totalChapters} chapters
                      </span>
                      <span className="meta-item">
                        👥 {session.participants.length} reader{session.participants.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="session-progress-section">
                  <div className="progress-header">
                    <span className="progress-label">Group Progress</span>
                    <span className="progress-percentage">{progressPercent}%</span>
                  </div>
                  <div className="progress-bar-large">
                    <div 
                      className="progress-fill-large" 
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <p className="progress-detail">
                    Average: Chapter {avgProgress} of {session.totalChapters}
                  </p>
                </div>

                <div className="participants-section">
                  <h4>Participants</h4>
                  <div className="participants-list">
                    {session.participants.map((participant, idx) => {
                      const participantPercent = session.totalChapters
                        ? Math.round((participant.currentChapter / session.totalChapters) * 100)
                        : 0;
                      
                      return (
                        <div key={idx} className="participant-item">
                          <div className="participant-info">
                            <span className="participant-name">
                              {participant.name}
                              {participant.isHost && <span className="host-badge">Host</span>}
                            </span>
                            <span className="participant-progress">
                              Chapter {participant.currentChapter} · {participantPercent}%
                            </span>
                          </div>
                          <div className="participant-progress-bar">
                            <div 
                              className="participant-progress-fill"
                              style={{ width: `${participantPercent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="session-actions-section">
                  <button className="session-action-btn primary">
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
    </div>
  );
}

export default Sessions;