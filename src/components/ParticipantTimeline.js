import React, { useEffect, useState } from 'react';
import { getUnreadTimeline } from '../utils/sessionsService';
import './ParticipantTimeline.css';

function ParticipantTimeline({ participant, session, currentUserId }) {
  const [unreadByChapter, setUnreadByChapter] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUnreadTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.sessionId, currentUserId]);

  const loadUnreadTimeline = async () => {
    try {
      setIsLoading(true);
      const data = await getUnreadTimeline(session.sessionId, currentUserId);
      setUnreadByChapter(data.unreadByChapter || {});
    } catch (error) {
      console.error('Error loading unread timeline:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const participantPercent = session.totalChapters
    ? Math.round((participant.currentChapter / session.totalChapters) * 100)
    : 0;

  // Calculate positions of unread message signposts
  const getSignpostPosition = (chapter) => {
    return (chapter / session.totalChapters) * 100;
  };

  // Only show unread signposts for chapters beyond the current participant's progress
  // and only for the current user viewing their own timeline
  const shouldShowSignpost = (chapter) => {
    return (
      currentUserId === participant.userId &&
      parseInt(chapter) > participant.currentChapter &&
      unreadByChapter[chapter] > 0
    );
  };

  return (
    <div className="participant-timeline-container">
      <div className="participant-info">
        <div className="participant-avatar">
          {participant.avatarUrl ? (
            <img src={participant.avatarUrl} alt={participant.displayName} />
          ) : (
            <div className="avatar-placeholder-small">
              {participant.displayName?.charAt(0).toUpperCase() || participant.name?.charAt(0).toUpperCase() || '?'}
            </div>
          )}
        </div>
        <div className="participant-details">
          <span className="participant-name">
            {participant.displayName || participant.name}
            {participant.isHost && <span className="host-badge-small">Host</span>}
          </span>
          <span className="participant-progress-text">
            Chapter {participant.currentChapter} · {participantPercent}%
          </span>
        </div>
      </div>

      <div className="timeline-progress-wrapper">
        <div className="timeline-progress-bar">
          <div
            className="timeline-progress-fill"
            style={{ width: `${participantPercent}%` }}
          />
        </div>

        {/* Unread message signposts */}
        {!isLoading && Object.keys(unreadByChapter).map((chapter) => {
          if (!shouldShowSignpost(chapter)) return null;

          const position = getSignpostPosition(parseInt(chapter));

          return (
            <div
              key={chapter}
              className="timeline-signpost"
              style={{ left: `${position}%` }}
              title={`${unreadByChapter[chapter]} unread message(s) at Chapter ${chapter}`}
            >
              <div className="signpost-bubble">
                <span className="signpost-chapter">{chapter}</span>
              </div>
              <div className="signpost-line"></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ParticipantTimeline;
