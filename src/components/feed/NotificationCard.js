import React, { useState } from 'react';
import { SmilePlus, Lock } from 'lucide-react';
import { Stars } from '../Reviews';
import { TIERS, typeFor } from './notificationTypes';
import './Notifications.css';

export const timeAgo = (iso) => {
  const mins = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  if (mins < 10080) return `${Math.floor(mins / 1440)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// Letter avatars get one of six muted inks, fixed per person
const inkFor = (id = '') => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 6;

export function Avatar({ person, size = 'md' }) {
  if (!person) return null;
  return person.avatarUrl
    ? <img src={person.avatarUrl} alt="" className={`notice-avatar is-${size}`} />
    : (
      <span className={`notice-avatar is-${size} is-letter ink-${inkFor(person.userId || person.displayName)}`} aria-hidden="true">
        {person.displayName?.charAt(0).toUpperCase() || '?'}
      </span>
    );
}

function Faces({ people = [], extra = 0 }) {
  return (
    <span className="notice-faces">
      {people.slice(0, 4).map(p => <Avatar key={p.userId || p.displayName} person={p} size="xs" />)}
      {extra > 0 && <span className="notice-faces-more">+{extra > 999 ? `${Math.round(extra / 100) / 10}k` : extra}</span>}
    </span>
  );
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
    <div className="notice-reactions">
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
            <button key={emoji} type="button" className={`reaction-option ${mine === emoji ? 'is-mine' : ''}`} onClick={() => choose(emoji)}>
              {emoji}
            </button>
          ))}
        </div>
      ) : (
        <button type="button" className="reaction-add" onClick={() => setPicking(true)} aria-label="Add a reaction">
          <SmilePlus size={15} />
        </button>
      )}
    </div>
  );
}

// Folded updates: faces or covers up front, every update on request
function GroupBody({ item }) {
  const [open, setOpen] = useState(false);
  const { by, items } = item.group;
  return (
    <div className="notice-group">
      {by === 'book' ? (
        <Faces people={items.map(m => m.actor)} />
      ) : (
        <span className="notice-fan">
          {items.slice(0, 5).map(m => <img key={m.itemId} src={m.book?.coverUrl} alt={m.book?.title} title={m.book?.title} />)}
        </span>
      )}
      <button type="button" className="notice-group-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? 'Hide' : `Show each (${items.length})`}
      </button>
      {open && (
        <ul className="notice-group-list">
          {items.map(m => (
            <li key={m.itemId}>
              <Avatar person={m.actor} size="xs" />
              <span>{by === 'book' ? m.actor?.displayName : <em>{m.book?.title}</em>}</span>
              <time dateTime={m.createdAt}>{timeAgo(m.createdAt)}</time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// The part of the card that changes with the form
function Body({ item, form, tier }) {
  switch (form) {
    case 'review':
      return (
        <div className="notice-review">
          <Stars rating={item.review?.rating || 0} />
          {item.review?.excerpt && <blockquote className="notice-quote">“{item.review.excerpt}”</blockquote>}
          {tier === 'community' && item.reviewer && (
            <span className="notice-byline">— {item.reviewer.displayName}{item.reviewer.note ? `, ${item.reviewer.note}` : ''}</span>
          )}
        </div>
      );
    case 'quote':
      return (
        <figure className="notice-passage">
          <blockquote>{item.quote?.text}</blockquote>
          {item.quote?.page && <figcaption>p. {item.quote.page}</figcaption>}
        </figure>
      );
    case 'progress': {
      const them = Math.round((item.progress || 0) * 100);
      const me = item.myProgress != null ? Math.round(item.myProgress * 100) : null;
      return (
        <div className="notice-progress" aria-label={`${them}% through${me != null ? `, you are at ${me}%` : ''}`}>
          <div className="notice-progress-rule">
            <span className="notice-progress-fill" style={{ width: `${them}%` }} />
            {me != null && <span className="notice-progress-me" style={{ left: `${me}%` }} title="You" />}
          </div>
          <span className="notice-progress-label">
            {item.position || `${them}%`}{me != null ? ` · you're at ${item.myPosition || `${me}%`}` : ''}
          </span>
        </div>
      );
    }
    case 'session':
      return (
        <div className="notice-session">
          <Faces people={item.session?.people} />
          <span className="notice-session-meta">
            {item.type === 'session_live' && <span className="notice-live-dot" aria-hidden="true" />}
            {item.session?.readers} reader{item.session?.readers !== 1 ? 's' : ''}
            {item.session?.position ? ` · ${item.session.position}` : ''}
          </span>
        </div>
      );
    case 'match':
      return (
        <div className="notice-match">
          {item.match?.score != null && (
            <span className="notice-match-score" aria-hidden="true">{item.match.score}<small>%</small></span>
          )}
          <div className="notice-match-why">
            {item.match?.because && <p>{item.match.because}</p>}
            {item.match?.books?.length > 0 && (
              <span className="notice-match-covers">
                {item.match.books.map(b => <img key={b.isbn} src={b.coverUrl} alt={b.title} title={b.title} />)}
              </span>
            )}
          </div>
        </div>
      );
    case 'locked':
      return (
        <div className="notice-locked">
          <span className="notice-locked-lines" aria-hidden="true"><i /><i /><i /></span>
          <span className="notice-locked-label">
            <Lock size={12} strokeWidth={2.2} aria-hidden="true" />
            Unlocks at {item.locked?.at}{item.locked?.togo ? ` · ${item.locked.togo}` : ''}
          </span>
        </div>
      );
    case 'recap':
      return (
        <div className="notice-recap">
          <dl>
            {(item.recap?.stats || []).map(st => (
              <div key={st.label}><dt>{st.label}</dt><dd>{st.value}</dd></div>
            ))}
          </dl>
          {item.recap?.standout && <p>{item.recap.standout}</p>}
        </div>
      );
    case 'group':
      return <GroupBody item={item} />;
    case 'milestone':
      return item.milestone?.sub ? <p className="notice-milestone-sub">{item.milestone.sub}</p> : null;
    case 'request':
      return item.mutuals?.length ? <Faces people={item.mutuals} /> : null;
    case 'stack':
      return item.faces?.length ? <Faces people={item.faces} extra={item.othersCount > 3 ? item.othersCount - 3 : 0} /> : null;
    default:
      return null;
  }
}

// One floating notification. state: { [actionId]: true | 'busy' | errorText }
function NotificationCard({ item, reactionSet = [], onReact, onAction, state = {}, index = 0, still = false }) {
  const def = typeFor(item.type);
  const { tier, form } = def;
  // A folded card borrows the label and icon of what it folds
  const base = item.type === 'grouped' ? typeFor(item.group.type) : def;
  const Icon = base.icon;
  const showCover = item.book?.coverUrl && !['match', 'milestone', 'recap'].includes(form);
  const actions = def.actions || [];
  const doneAction = actions.find(a => state[a.id] === true);
  const error = Object.values(state).find(v => typeof v === 'string' && v !== 'busy');
  const emblem = tier === 'pagebound' || tier === 'community' || !item.actor;

  return (
    <article
      className={`notice tier-${tier} form-${form} ${still ? 'is-still' : ''}`}
      style={{ '--i': index }}
      aria-label={`${base.label}${tier === 'direct' ? ', for you' : ''}`}
    >
      <div className="notice-marker">
        {emblem ? (
          <span className="notice-emblem" aria-hidden="true"><Icon size={form === 'milestone' ? 22 : 17} strokeWidth={1.6} /></span>
        ) : (
          <>
            <Avatar person={item.actor} />
            <span className="notice-seal" aria-hidden="true"><Icon size={10} strokeWidth={2.2} /></span>
          </>
        )}
      </div>

      <div className="notice-main">
        <header className="notice-overline">
          {tier === 'direct' && <span className="notice-tier-tag">{TIERS.direct.label}</span>}
          {tier === 'community' && <span className="notice-tier-tag">{TIERS.community.label}</span>}
          <span className="notice-kind">{base.label}</span>
          <time className="notice-time" dateTime={item.createdAt}>{timeAgo(item.createdAt)}</time>
        </header>

        <p className="notice-headline">{def.headline(item)}</p>
        {item.note && <blockquote className="notice-quote">“{item.note}”</blockquote>}
        <Body item={item} form={form} tier={tier} />

        {(actions.length > 0 || def.reactable) && (
          <footer className="notice-footer">
            {actions.length > 0 && onAction && (
              <div className="notice-actions">
                {doneAction ? (
                  <span className="notice-done">✓ {doneAction.done || 'Done'}</span>
                ) : actions.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    className={`notice-btn ${a.primary ? 'is-primary' : ''}`}
                    onClick={() => onAction(item, a)}
                    disabled={state[a.id] === 'busy'}
                  >
                    {state[a.id] === 'busy' ? '…' : a.label}
                  </button>
                ))}
              </div>
            )}
            {def.reactable && onReact && <Reactions item={item} reactionSet={reactionSet} onReact={onReact} />}
          </footer>
        )}
        {error && <p className="notice-error">{error}</p>}
      </div>

      {showCover && <img src={item.book.coverUrl} alt="" className="notice-cover" />}
    </article>
  );
}

export default NotificationCard;
