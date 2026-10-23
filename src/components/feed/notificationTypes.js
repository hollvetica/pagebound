// The feed's pattern library: every notification type, which audience tier it
// belongs to, and which card form it uses. NotificationCard renders from this,
// and the dev-only pattern page (?preview&patterns) documents it.
//
// Tier = who it's about / who it's for. It sets the card's treatment.
// Form = what it carries. It sets the card's body layout.
import React from 'react';
import {
  BookOpen, BookCheck, BookmarkPlus, Star, Users, Quote, Flame, Target, Sparkles,
  TrendingUp, Feather, UserPlus, MessageCircle, Radio, Trophy, Gauge, Heart, Gift, Lock, CalendarDays, Layers
} from 'lucide-react';

export const TIERS = {
  direct: {
    label: 'For you',
    summary: 'Addressed to you and usually wants an answer: a recommendation, an invite, a request, a reply.',
    treatment: 'Brass hairline and glow, "For you" tag, actions on the card. The loudest tier, so keep it rare.'
  },
  friend: {
    label: 'Friends',
    summary: 'What the people you follow are reading, finishing, reviewing and quoting.',
    treatment: 'Raised vellum card led by the friend\'s avatar, with a type seal on the avatar. The everyday tier.'
  },
  pagebound: {
    label: 'From Pagebound',
    summary: 'About you, from the app: book matches, streaks, goals and milestones.',
    treatment: 'Book-plate frame (double rule), centred emblem, serif headline. Celebratory, never urgent.'
  },
  community: {
    label: 'Around Pagebound',
    summary: 'The wider readership: trending books, new releases, reviews from readers you don\'t know.',
    treatment: 'Patina accent, sunken glassy card, emblem instead of a face, smaller type. Quiet by design.'
  }
};

export const FORMS = {
  status: 'One line plus a cover. Shelf changes and simple updates.',
  review: 'Stars and a serif pull-quote, like a margin note.',
  quote: 'A passage set large in italic serif with the page it came from.',
  progress: 'A thin progress rule that shows where someone is in the book.',
  session: 'Readers and a live marker, with a Join or Read-together action.',
  match: 'A score and the reason for it, with the books that produced it.',
  milestone: 'An emblem and a number. Streaks, goals, finished counts.',
  request: 'A person and Accept / Decline.',
  stack: 'Several faces or a count. Many people did one thing.',
  locked: 'A blurred comment with where it unlocks. Never shows spoiler text.',
  recap: 'A short row of stats with one standout line.',
  group: 'Several updates folded into one card, with a "Show each" list.'
};

const who = (item) => <strong>{item.actor?.displayName}</strong>;
const title = (item) => <em>{item.book?.title}</em>;
const others = (n) => (n > 0 ? ` and ${n} other${n !== 1 ? 's' : ''}` : '');

export const TYPES = {
  // ---------------------------------------------------------------- friends
  started_reading: {
    tier: 'friend', form: 'status', label: 'Started', icon: BookOpen, reactable: true,
    headline: (i) => <>{who(i)} started {title(i)}</>,
    actions: [{ id: 'read_together', label: 'Read together' }]
  },
  book_added: {
    tier: 'friend', form: 'status', label: 'Shelved', icon: BookmarkPlus, reactable: true,
    headline: (i) => <>{who(i)} added {title(i)} to {i.shelf || 'their library'}</>,
    actions: [{ id: 'read_together', label: 'Read together' }]
  },
  finished_book: {
    tier: 'friend', form: 'status', label: 'Finished', icon: BookCheck, reactable: true,
    headline: (i) => <>{who(i)} finished {title(i)}</>
  },
  progress_update: {
    tier: 'friend', form: 'progress', label: 'Progress', icon: Gauge, reactable: true,
    headline: (i) => <>{who(i)} is {Math.round((i.progress || 0) * 100)}% through {title(i)}</>
  },
  book_reviewed: {
    tier: 'friend', form: 'review', label: 'Review', icon: Star, reactable: true,
    headline: (i) => <>{who(i)} reviewed {title(i)}</>
  },
  quote_shared: {
    tier: 'friend', form: 'quote', label: 'Passage', icon: Quote, reactable: true,
    headline: (i) => <>{who(i)} marked a passage in {title(i)}</>
  },
  session_started: {
    tier: 'friend', form: 'session', label: 'Session', icon: Users, reactable: true,
    headline: (i) => {
      const n = (i.session?.readers || 1) - 1;
      return <>{who(i)} started a session for {title(i)}{n > 0 ? ` with ${n} friend${n !== 1 ? 's' : ''}` : ''}</>;
    }
  },

  // ---------------------------------------------------------------- for you
  recommendation: {
    tier: 'direct', form: 'status', label: 'Recommended', icon: Gift, reactable: true,
    headline: (i) => <>{who(i)} recommended {title(i)} to you</>,
    actions: [{ id: 'add_to_library', label: 'Add to library', primary: true, done: 'In your library' }]
  },
  session_invite: {
    tier: 'direct', form: 'session', label: 'Invite', icon: Users,
    headline: (i) => <>{who(i)} invited you to read {title(i)}</>,
    actions: [
      { id: 'join_session', label: 'Join', primary: true, done: 'Joined' },
      { id: 'dismiss', label: 'Not now', done: 'Dismissed' }
    ]
  },
  session_live: {
    tier: 'direct', form: 'session', label: 'Live now', icon: Radio,
    headline: (i) => <>{who(i)}{others((i.session?.active || 1) - 1)} are reading {title(i)} right now</>,
    actions: [{ id: 'open_session', label: 'Open session', primary: true, done: 'Opened' }]
  },
  caught_up: {
    tier: 'direct', form: 'progress', label: 'Caught up', icon: Gauge,
    headline: (i) => <>{who(i)} caught up to you in {title(i)}. {i.unlocked ? `${i.unlocked} comments just unlocked.` : ''}</>,
    actions: [{ id: 'open_session', label: 'Read comments', primary: true, done: 'Opened' }]
  },
  friend_request: {
    tier: 'direct', form: 'request', label: 'Friend request', icon: UserPlus,
    headline: (i) => <>{who(i)} wants to be friends{i.mutualCount ? ` · ${i.mutualCount} mutual` : ''}</>,
    actions: [
      { id: 'accept', label: 'Accept', primary: true, done: 'Friends now' },
      { id: 'decline', label: 'Decline', done: 'Declined' }
    ]
  },
  review_reply: {
    tier: 'direct', form: 'stack', label: 'Reply', icon: MessageCircle,
    headline: (i) => <>{who(i)}{others(i.othersCount)} replied to your review of {title(i)}</>,
    actions: [{ id: 'view_review', label: 'View', done: 'Seen' }]
  },

  session_member: {
    tier: 'direct', form: 'session', label: 'Your session', icon: Users,
    headline: (i) => <>{who(i)} {i.change === 'left' ? 'left' : 'joined'} your session for {title(i)}</>,
    actions: [{ id: 'open_session', label: 'Open session', done: 'Opened' }]
  },
  recommendation_taken: {
    tier: 'direct', form: 'status', label: 'Your pick', icon: Gift, reactable: true,
    headline: (i) => <>{who(i)} added {title(i)} to {i.shelf || 'their library'}. You recommended it.</>
  },
  locked_comment: {
    tier: 'direct', form: 'locked', label: 'Spoiler-safe', icon: Lock,
    headline: (i) => <>{who(i)}{others((i.locked?.count || 1) - 1)} left a comment in {title(i)} at {i.locked?.at}</>,
    actions: [{ id: 'open_session', label: 'Update my progress', done: 'Opened' }]
  },

  // ---------------------------------------------------------------- pagebound
  year_recap: {
    tier: 'pagebound', form: 'recap', label: 'Your year', icon: CalendarDays,
    headline: (i) => <>Your {i.recap?.year} in books, so far</>,
    actions: [{ id: 'view_recap', label: 'See your year', primary: true, done: 'Opened' }]
  },
  book_match: {
    tier: 'pagebound', form: 'match', label: 'Book match', icon: Sparkles,
    headline: (i) => <>We think you'll love {title(i)}</>,
    actions: [{ id: 'add_to_library', label: 'Want to read', primary: true, done: 'On your shelf' }]
  },
  reader_match: {
    tier: 'pagebound', form: 'match', label: 'Reading twin', icon: Heart,
    headline: (i) => <>You and {who(i)} have {i.match?.shared} books in common</>,
    actions: [{ id: 'view_profile', label: 'See their shelves', done: 'Opened' }]
  },
  reading_streak: {
    tier: 'pagebound', form: 'milestone', label: 'Streak', icon: Flame,
    headline: (i) => <>{i.milestone?.value} days in a row</>
  },
  goal_progress: {
    tier: 'pagebound', form: 'milestone', label: 'Reading goal', icon: Target,
    headline: (i) => <>{i.milestone?.value} of {i.milestone?.target} books this year</>
  },
  milestone: {
    tier: 'pagebound', form: 'milestone', label: 'Milestone', icon: Trophy,
    headline: (i) => <>{i.milestone?.text}</>
  },

  // ---------------------------------------------------------------- community
  trending: {
    tier: 'community', form: 'stack', label: 'Trending', icon: TrendingUp, reactable: true,
    headline: (i) => <>{title(i)} is trending · {i.count?.toLocaleString()} readers started it this week</>,
    actions: [{ id: 'add_to_library', label: 'Want to read', done: 'On your shelf' }]
  },
  new_release: {
    tier: 'community', form: 'status', label: 'New release', icon: Feather,
    headline: (i) => <>New from {i.book?.author}: {title(i)}</>,
    actions: [{ id: 'add_to_library', label: 'Want to read', done: 'On your shelf' }]
  },
  community_review: {
    tier: 'community', form: 'review', label: 'Reader review', icon: Star, reactable: true,
    headline: (i) => <>A reader reviewed {title(i)}, which is on your shelf</>
  }
};

// Built on the client by groupFeed(): several friend updates in one card
const VERBS = { started_reading: 'started', book_added: 'added', finished_book: 'finished' };
const nameList = (people) => {
  const names = people.map(p => p.displayName);
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} other${names.length > 3 ? 's' : ''}`;
};
TYPES.grouped = {
  tier: 'friend', form: 'group', label: 'Together', icon: Layers,
  headline: (i) => {
    const { by, type, items } = i.group;
    const verb = VERBS[type] || 'updated';
    const shelf = type === 'book_added' && i.shelf ? ` to ${i.shelf}` : '';
    return by === 'book'
      ? <><strong>{nameList(items.map(m => m.actor))}</strong> {verb} {title(i)}{shelf}</>
      : <>{who(i)} {verb} {items.length} books{shelf}</>;
  }
};

// Unknown types (a newer backend) still render as a plain friend update
export const typeFor = (type) => TYPES[type] || {
  tier: 'friend', form: 'status', label: 'Update', icon: BookOpen, reactable: true,
  headline: (i) => <>{who(i)} shared an update</>
};
