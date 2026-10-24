import React, { useState } from 'react';
import NotificationCard from '../components/feed/NotificationCard';
import { TIERS, FORMS, TYPES } from '../components/feed/notificationTypes';
import { buildSampleFeed } from '../components/feed/feedSamples';
import { groupFeed } from '../components/feed/groupFeed';
import './NotificationPatterns.css';

// Dev-only pattern library for feed notifications: ?preview&patterns
const REACTIONS = ['❤️', '🔥', '😂', '😮', '📚'];

// Live = works with what the backend sends today (grouping runs on the client).
// The rest only exist in the sample feed.
const LIVE_TYPES = ['grouped', 'trending','started_reading', 'book_added', 'finished_book', 'book_reviewed', 'session_started', 'recommendation'];

function NotificationPatterns() {
  const [items, setItems] = useState(buildSampleFeed);
  const [state, setState] = useState({});
  const [replay, setReplay] = useState(0);

  const shown = groupFeed(items);
  const ofType = (type) => shown.filter(i => i.type === type);

  const onReact = (item, emoji) => setItems(all => all.map(i => {
    if (i.itemId !== item.itemId) return i;
    const counts = { ...(i.reactions?.counts || {}) };
    if (i.reactions?.mine) counts[i.reactions.mine] = Math.max(0, (counts[i.reactions.mine] || 1) - 1);
    if (emoji) counts[emoji] = (counts[emoji] || 0) + 1;
    return { ...i, reactions: { counts, mine: emoji } };
  }));
  const onAction = (item, action) => setState(s => ({ ...s, [item.itemId]: { [action.id]: true } }));

  return (
    <div className="page patterns-page">
      <header className="patterns-intro">
        <p className="patterns-overline">Pattern library</p>
        <h2>Feed notifications</h2>
        <p>
          Every feed item is its own card. Its <strong>tier</strong> (who it is about, or who it is for) sets the
          treatment; its <strong>form</strong> (what it carries) sets the body. Tiers go from loudest to quietest.
        </p>
        <button type="button" className="btn-ghost btn-sm" onClick={() => { setReplay(r => r + 1); setState({}); }}>
          Replay entrance
        </button>
      </header>

      {Object.entries(TIERS).map(([tierKey, tier]) => (
        <section key={tierKey} className="patterns-tier">
          <div className="patterns-tier-head">
            <span className={`patterns-swatch tier-${tierKey}`} aria-hidden="true" />
            <div>
              <h3>{tier.label}</h3>
              <p>{tier.summary}</p>
              <p className="patterns-treatment">{tier.treatment}</p>
            </div>
          </div>

          <div className="patterns-grid" key={replay}>
            {Object.entries(TYPES).filter(([, t]) => t.tier === tierKey).flatMap(([typeKey, t]) => ofType(typeKey).map(item => (
              <figure key={item.itemId} className="patterns-specimen">
                <NotificationCard
                  item={item}
                  reactionSet={REACTIONS}
                  onReact={onReact}
                  onAction={onAction}
                  state={state[item.itemId]}
                />
                <figcaption>
                  <code>{typeKey}{item.group ? ` · by ${item.group.by}` : ''}</code>
                  <span>{t.form}</span>
                  {LIVE_TYPES.includes(typeKey)
                    ? <span className="patterns-pill is-live">live</span>
                    : <span className="patterns-pill">needs backend</span>}
                </figcaption>
              </figure>
            )))}
          </div>
        </section>
      ))}

      <section className="patterns-tier">
        <h3>Forms</h3>
        <dl className="patterns-forms">
          {Object.entries(FORMS).map(([k, v]) => (
            <div key={k}><dt><code>{k}</code></dt><dd>{v}</dd></div>
          ))}
        </dl>
      </section>

      <section className="patterns-tier">
        <h3>Rules</h3>
        <ul className="patterns-rules">
          <li>One accent per card. Brass for For you, Friends and From Pagebound; patina for Around Pagebound.</li>
          <li>Only For you cards carry a primary button by default; elsewhere actions stay outlined.</li>
          <li>Faces mean people you know. Strangers and the app get an emblem instead.</li>
          <li>Reactions only on things a person did (and trending books). Never on invites, requests or milestones.</li>
          <li>Cards enter with a short rise, staggered 55ms; nothing animates under reduced motion except the live dot.</li>
        </ul>
      </section>
    </div>
  );
}

export default NotificationPatterns;
