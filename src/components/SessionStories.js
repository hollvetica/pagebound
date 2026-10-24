import React from 'react';
import { Plus, Users } from 'lucide-react';
import './SessionStories.css';

// Your reading sessions as a row of covers, like stories: a brass ring and
// badge mean something new (comments or an invite), the people pill counts
// the readers, the rule under each cover is your own progress. Tapping one
// opens it on the Sessions tab.
function SessionStories({ sessions, onOpen, onStart }) {
  const progressOf = (session) => {
    const byPages = session.trackingMode === 'pages';
    const me = session.participants.find(p => p.isMe) || {};
    const current = (byPages ? me.currentPage : me.currentChapter) || 0;
    const total = (byPages ? session.totalPages : session.totalChapters) || 0;
    return total ? Math.min(100, Math.round((current / total) * 100)) : 0;
  };

  return (
    <section className="stories" aria-label="Your reading sessions">
      <div className="stories-head">
        <h3>Reading now</h3>
        {sessions.length > 0 && <span className="stories-count">{sessions.length}</span>}
      </div>

      <div className="stories-row" role="list">
        {sessions.map((session) => {
          const progress = progressOf(session);
          const others = session.participants.filter(p => !p.isMe);
          const readers = session.participants.length;
          const isNew = session.newCount > 0;
          return (
            <button
              key={session.id}
              type="button"
              role="listitem"
              className={`story ${isNew ? 'is-new' : ''}`}
              onClick={() => onOpen(session)}
              aria-label={`${session.bookTitle}, ${readers} reader${readers !== 1 ? 's' : ''}${others.length ? ` (with ${others.map(p => p.name).join(', ')})` : ''}${isNew ? `, ${session.newCount} new` : ''}`}
            >
              <span className="story-ring">
                <span className="story-cover">
                  {session.bookCover
                    ? <img src={session.bookCover} alt="" />
                    : <span className="story-cover-blank" aria-hidden="true">{session.bookTitle?.charAt(0)}</span>}
                </span>
                {isNew && <span className="story-badge" aria-hidden="true">{session.newCount > 9 ? '9+' : session.newCount}</span>}
                <span className="story-readers" aria-hidden="true">
                  <Users size={13} strokeWidth={2} />
                  <span className="story-readers-count">{readers}</span>
                </span>
              </span>
              <span className="story-progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></span>
              <span className="story-title">{session.sessionName || session.bookTitle}</span>
            </button>
          );
        })}

        <button type="button" role="listitem" className="story story-start" onClick={onStart}>
          <span className="story-ring">
            <span className="story-cover story-cover-start" aria-hidden="true"><Plus size={20} strokeWidth={1.75} /></span>
          </span>
          <span className="story-title">{sessions.length ? 'New session' : 'Start a session'}</span>
        </button>
      </div>
    </section>
  );
}

export default SessionStories;
