import React, { useEffect, useState } from 'react';
import { getUnreadTimeline } from '../utils/sessionsService';
import { isPreviewMode } from '../utils/previewMode';
import './ParticipantTimeline.css';

// One reader's progress through the session. On the signed-in reader's own
// row, signposts mark unread comments further ahead (spoiler-free: only the
// position is shown).
function ParticipantTimeline({ participant, session, currentUserId }) {
  const [unreadByPosition, setUnreadByPosition] = useState({});

  const isMine = participant.isMe || participant.userId === currentUserId;
  const byPages = session.trackingMode === 'pages';
  const unitLabel = byPages ? 'Page' : 'Chapter';
  const total = (byPages ? session.totalPages : session.totalChapters) || 0;
  const current = (byPages ? participant.currentPage : participant.currentChapter) || 0;
  const percent = total ? Math.min(100, Math.round((current / total) * 100)) : 0;

  useEffect(() => {
    if (!isMine || isPreviewMode()) return;
    let cancelled = false;
    getUnreadTimeline(session.sessionId)
      .then(data => { if (!cancelled) setUnreadByPosition(data.unreadByPosition || data.unreadByChapter || {}); })
      .catch(error => console.error('Error loading unread timeline:', error));
    return () => { cancelled = true; };
  }, [isMine, session.sessionId, session.updatedAt]);

  const signposts = Object.entries(unreadByPosition)
    .map(([position, count]) => [parseInt(position, 10), count])
    .filter(([position, count]) => count > 0 && position > current && total);

  return (
    <div className="participant-timeline-container">
      <div className="participant-info">
        <div className="participant-avatar">
          {participant.avatarUrl ? (
            <img src={participant.avatarUrl} alt={participant.name} />
          ) : (
            <div className="avatar-placeholder-small">
              {participant.name?.charAt(0).toUpperCase() || '?'}
            </div>
          )}
        </div>
        <div className="participant-details">
          <span className="participant-name">
            {isMine ? 'You' : participant.name}
            {participant.isHost && <span className="host-badge-small">Host</span>}
          </span>
          <span className="participant-progress-text">
            {unitLabel} {current} · {percent}%
          </span>
        </div>
      </div>

      <div className="timeline-progress-wrapper">
        <div className="timeline-progress-bar">
          <div
            className="timeline-progress-fill"
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* Unread comments ahead of this reader */}
        {signposts.map(([position, count]) => (
          <div
            key={position}
            className="timeline-signpost"
            style={{ left: `${Math.min(100, (position / total) * 100)}%` }}
            title={`${count} comment${count !== 1 ? 's' : ''} waiting at ${unitLabel.toLowerCase()} ${position}`}
          >
            <div className="signpost-bubble">
              <span className="signpost-chapter">{position}</span>
            </div>
            <div className="signpost-line"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ParticipantTimeline;
