import React, { useMemo, useState } from 'react';
import NotificationCard from './feed/NotificationCard';
import { groupFeed } from './feed/groupFeed';
import './ActivityFeed.css';

// Home feed: each item is its own floating card. Card styles and the type
// registry live in ./feed (see notificationTypes.js).
function ActivityFeed({ items, reactionSet, loading, onReact, onSuggestSession, onAddToLibrary }) {
  const shown = useMemo(() => groupFeed(items), [items]);
  const [actionState, setActionState] = useState({}); // itemId -> { actionId: true | 'busy' | error }

  const mark = (item, actionId, value) =>
    setActionState(s => ({ ...s, [item.itemId]: { ...s[item.itemId], [actionId]: value } }));

  const handleAction = async (item, action) => {
    if (action.id === 'read_together') {
      onSuggestSession(item);
      return;
    }
    if (action.id === 'add_to_library') {
      mark(item, action.id, 'busy');
      try {
        await onAddToLibrary(item.book);
        mark(item, action.id, true);
      } catch (err) {
        mark(item, action.id, err.status === 409 ? true : 'Could not add it. Try again.');
      }
      return;
    }
    // The remaining actions belong to types only the sample feed has so far
    mark(item, action.id, true);
  };

  return (
    <section className="activity-feed" aria-label="Activity">
      <h3>Activity</h3>

      {loading && items.length === 0 ? (
        <p className="activity-empty">Loading…</p>
      ) : items.length === 0 ? (
        <p className="activity-empty">
          When your friends add, start or finish books, it shows up here.
        </p>
      ) : (
        <div className="notice-stack">
          {shown.map((item, i) => (
            <NotificationCard
              key={item.itemId}
              item={item}
              index={i}
              reactionSet={reactionSet}
              onReact={onReact}
              onAction={handleAction}
              state={actionState[item.itemId]}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default ActivityFeed;
