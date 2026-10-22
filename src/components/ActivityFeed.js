import React, { useState } from 'react';
import { SmilePlus } from 'lucide-react';
import { Stars } from './Reviews';
import './ActivityFeed.css';

const timeAgo = (iso) => {
  const mins = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  if (mins < 10080) return `${Math.floor(mins / 1440)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

function Avatar({ actor }) {
  return actor.avatarUrl
    ? <img src={actor.avatarUrl} alt="" className="activity-avatar" />
    : <div className="activity-avatar-letter" aria-hidden="true">{actor.displayName?.charAt(0).toUpperCase() || '?'}</div>;
}

function describe(item) {
  const who = <strong>{item.actor.displayName}</strong>;
  const title = <em>{item.book?.title}</em>;
  switch (item.type) {
    case 'started_reading':
      return <>{who} started reading {title}</>;
    case 'finished_book':
      return <>{who} finished {title}</>;
    case 'book_added':
      return <>{who} added {title} to {item.shelf || 'their library'}</>;
    case 'session_started': {
      const others = (item.session?.readers || 1) - 1;
      return <>{who} started a reading session for {title}{others > 0 ? ` with ${others} friend${others !== 1 ? 's' : ''}` : ''}</>;
    }
    case 'recommendation':
      return <>{who} recommended {title} to you</>;
    case 'book_reviewed':
      return <>{who} reviewed {title}</>;
    default:
      return <>{who} shared an update</>;
  }
}

function Reactions({ item, reactionSet, onReact }) {
  const [picking, setPicking] = useState(false);
  const { counts = {}, mine = null } = item.reactions || {};
  const shown = reactionSet.filter(e => counts[e] > 0);

  const choose = (emoji) => {
    setPicking(false);
    onReact(item, mine === emoji ? null : emoji);
  };

  return (
    <div className="activity-reactions">
      {shown.map(emoji => (
        <button
          key={emoji}
          type="button"
          className={`reaction-chip ${mine === emoji ? 'is-mine' : ''}`}
          onClick={() => choose(emoji)}
          aria-pressed={mine === emoji}
          aria-label={`${emoji} ${counts[emoji]}${mine === emoji ? ', yours' : ''}`}
        >
          <span aria-hidden="true">{emoji}</span> {counts[emoji]}
        </button>
      ))}
      {picking ? (
        <div className="reaction-picker" role="group" aria-label="Pick a reaction">
          {reactionSet.map(emoji => (
            <button
              key={emoji}
              type="button"
              className={`reaction-option ${mine === emoji ? 'is-mine' : ''}`}
              onClick={() => choose(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : (
        <button type="button" className="reaction-add" onClick={() => setPicking(true)} aria-label="Add a reaction">
          <SmilePlus size={16} />
        </button>
      )}
    </div>
  );
}

// Friends' activity and recommendations on Home
function ActivityFeed({ items, reactionSet, loading, onReact, onSuggestSession, onAddToLibrary }) {
  const [added, setAdded] = useState({}); // itemId -> 'adding' | 'added' | error message

  const handleAdd = async (item) => {
    setAdded(a => ({ ...a, [item.itemId]: 'adding' }));
    try {
      await onAddToLibrary(item.book);
      setAdded(a => ({ ...a, [item.itemId]: 'added' }));
    } catch (err) {
      setAdded(a => ({ ...a, [item.itemId]: err.status === 409 ? 'added' : 'Could not add it. Try again.' }));
    }
  };

  return (
    <div className="activity-feed">
      <h3>Friend Activity</h3>

      {loading && items.length === 0 ? (
        <p className="activity-empty">Loading…</p>
      ) : items.length === 0 ? (
        <p className="activity-empty">
          When your friends add, start or finish books, it shows up here.
        </p>
      ) : (
        <div className="activity-list">
          {items.map(item => {
            const state = added[item.itemId];
            return (
              <div key={item.itemId} className={`activity-item ${item.type === 'recommendation' ? 'is-recommendation' : ''}`}>
                <div className="activity-content">
                  <Avatar actor={item.actor} />
                  <div className="activity-text">
                    <p>{describe(item)}</p>
                    {item.note && <blockquote className="activity-note">“{item.note}”</blockquote>}
                    {item.review && (
                      <div className="activity-review">
                        <Stars rating={item.review.rating} />
                        {item.review.excerpt && <blockquote className="activity-note">“{item.review.excerpt}”</blockquote>}
                      </div>
                    )}

                    {item.type === 'recommendation' && (
                      state === 'added' ? (
                        <span className="activity-done">✓ In your library</span>
                      ) : (
                        <button
                          type="button"
                          className="suggest-session-btn is-primary"
                          onClick={() => handleAdd(item)}
                          disabled={state === 'adding'}
                        >
                          {state === 'adding' ? 'Adding…' : 'Add to library'}
                        </button>
                      )
                    )}
                    {state && !['adding', 'added'].includes(state) && <p className="activity-error">{state}</p>}

                    {(item.type === 'started_reading' || item.type === 'book_added') && onSuggestSession && (
                      <button type="button" className="suggest-session-btn" onClick={() => onSuggestSession(item)}>
                        📚 Read together
                      </button>
                    )}
                  </div>
                  {item.book?.coverUrl && <img src={item.book.coverUrl} alt="" className="activity-cover" />}
                </div>
                <div className="activity-footer">
                  <span className="activity-time">{timeAgo(item.createdAt)}</span>
                  <Reactions item={item} reactionSet={reactionSet} onReact={onReact} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ActivityFeed;
