// Placeholder people and one feed item per notification type, for looking at
// the feed in dev preview (?preview) and on the pattern page (?preview&patterns).
// Never used by the live app or the portfolio demo build.

const cover = (isbn) => `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`;
const ago = (hours) => new Date(Date.now() - hours * 3600e3).toISOString();
const person = (userId, username, displayName) => ({ userId, username, displayName, avatarUrl: null });
const book = (isbn, title, author) => ({ isbn, title, author, coverUrl: cover(isbn) });
const none = () => ({ counts: {}, mine: null });

// ---------------------------------------------------------------- people
export const SAMPLE_PEOPLE = {
  sam: person('u-sam', 'samreads', 'Sam'),
  priya: person('u-priya', 'priya.k', 'Priya'),
  leo: person('u-leo', 'leo_turns_pages', 'Leo'),
  nora: person('u-nora', 'nora', 'Nora'),
  theo: person('u-theo', 'theo.inkwell', 'Theo'),
  imogen: person('u-imogen', 'imogen_reads', 'Imogen'),
  rafael: person('u-rafael', 'rafa.lit', 'Rafael'),
  wren: person('u-wren', 'wrenwrites', 'Wren'),
  // Not friends: the wider readership
  odette: person('u-odette', 'odette.m', 'Odette M.'),
  kwame: person('u-kwame', 'kwame.b', 'Kwame B.'),
  lucia: person('u-lucia', 'lucia.v', 'Lucía V.'),
  hal: person('u-hal', 'hal9', 'Hal')
};
const P = SAMPLE_PEOPLE;

// ---------------------------------------------------------------- books
const B = {
  nameOfWind: book('9780756404741', 'The Name of the Wind', 'Patrick Rothfuss'),
  circe: book('9780316556347', 'Circe', 'Madeline Miller'),
  secretHistory: book('9781400031702', 'The Secret History', 'Donna Tartt'),
  piranesi: book('9781635575637', 'Piranesi', 'Susanna Clarke'),
  nightCircus: book('9780385534635', 'The Night Circus', 'Erin Morgenstern'),
  mexicanGothic: book('9780525620785', 'Mexican Gothic', 'Silvia Moreno-Garcia'),
  hailMary: book('9780593135204', 'Project Hail Mary', 'Andy Weir'),
  evelynHugo: book('9781501161933', 'The Seven Husbands of Evelyn Hugo', 'Taylor Jenkins Reid'),
  tomorrow: book('9780593321201', 'Tomorrow, and Tomorrow, and Tomorrow', 'Gabrielle Zevin'),
  ifWeWereVillains: book('9781250095282', 'If We Were Villains', 'M. L. Rio'),
  babel: book('9780063021426', 'Babel', 'R. F. Kuang'),
  shadowWind: book('9780143034902', 'The Shadow of the Wind', 'Carlos Ruiz Zafón'),
  remains: book('9780679731726', 'The Remains of the Day', 'Kazuo Ishiguro'),
  starlessSea: book('9780385541213', 'The Starless Sea', 'Erin Morgenstern'),
  rebecca: book('9780380730407', 'Rebecca', 'Daphne du Maurier')
};

// One of each type, newest first, mixed the way a real day would be
export const buildSampleFeed = () => [
  {
    itemId: 's|invite', type: 'session_invite', actor: P.theo, book: B.ifWeWereVillains,
    note: 'Starting Friday. One act a week?',
    session: { readers: 3, people: [P.theo, P.imogen, P.wren], position: 'Act I' }, createdAt: ago(0.2)
  },
  {
    itemId: 's|live', type: 'session_live', actor: P.sam, book: B.nightCircus,
    session: { readers: 3, active: 2, people: [P.sam, P.priya], position: 'Ch. 9 of 15' }, createdAt: ago(0.4)
  },
  {
    itemId: 's|joined', type: 'session_member', change: 'joined', actor: P.wren, book: B.nightCircus,
    session: { readers: 4, people: [P.sam, P.priya, P.wren], position: 'Ch. 9 of 15' }, createdAt: ago(0.7)
  },
  {
    itemId: 's|quote', type: 'quote_shared', actor: P.imogen, book: B.piranesi,
    quote: { text: 'The Beauty of the House is immeasurable; its Kindness infinite.', page: 5 },
    createdAt: ago(0.9), reactions: { counts: { '❤️': 4, '📚': 1 }, mine: null }
  },
  {
    itemId: 's|rec', type: 'recommendation', actor: P.priya, book: B.evelynHugo,
    note: 'You loved Circe. This has the same sad, golden glow.', createdAt: ago(1.5), reactions: none()
  },
  {
    itemId: 's|match', type: 'book_match', book: B.babel,
    match: { score: 94, because: 'Because you rated The Secret History and Circe five stars.', books: [B.secretHistory, B.circe] },
    createdAt: ago(2.5)
  },
  {
    itemId: 's|locked', type: 'locked_comment', actor: P.sam, book: B.nightCircus,
    locked: { at: 'Ch. 12', togo: '4 chapters to go', count: 2 }, createdAt: ago(2.8)
  },
  {
    itemId: 's|started', type: 'started_reading', actor: P.sam, book: B.nameOfWind, shelf: 'Currently Reading',
    createdAt: ago(3), reactions: { counts: { '❤️': 2, '📚': 1 }, mine: '❤️' }
  },
  {
    itemId: 's|caught', type: 'caught_up', actor: P.priya, book: B.nightCircus, unlocked: 3,
    progress: 0.53, position: "You're both at Ch. 8 of 15", createdAt: ago(4)
  },
  {
    itemId: 's|trend', type: 'trending', book: B.starlessSea, count: 1240,
    faces: [P.odette, P.kwame, P.lucia], othersCount: 1240, createdAt: ago(5), reactions: none()
  },
  {
    itemId: 's|review', type: 'book_reviewed', actor: P.nora, book: B.circe,
    review: { rating: 5, excerpt: 'A goddess learning to be a person. I cried on the train. Twice.' },
    createdAt: ago(6), reactions: { counts: { '😮': 1, '❤️': 3 }, mine: null }
  },
  {
    itemId: 's|request', type: 'friend_request', actor: P.rafael, mutualCount: 2, mutuals: [P.leo, P.nora], createdAt: ago(8)
  },
  {
    itemId: 's|taken', type: 'recommendation_taken', actor: P.sam, book: B.circe, shelf: 'Want to Read',
    createdAt: ago(9), reactions: none()
  },
  {
    itemId: 's|progress', type: 'progress_update', actor: P.leo, book: B.mexicanGothic,
    progress: 0.48, myProgress: 0.3, position: 'p. 152 of 320', myPosition: 'p. 96', createdAt: ago(10),
    reactions: { counts: { '🔥': 1 }, mine: null }
  },
  {
    itemId: 's|streak', type: 'reading_streak', milestone: { value: 12, sub: 'Your longest run since March. Read a page today to keep it.' },
    createdAt: ago(12)
  },
  {
    itemId: 's|reply', type: 'review_reply', actor: P.wren, book: B.secretHistory, othersCount: 3,
    faces: [P.wren, P.theo, P.sam], createdAt: ago(14)
  },
  {
    itemId: 's|session', type: 'session_started', actor: P.nora, book: B.hailMary,
    session: { readers: 3, people: [P.nora, P.hal, P.leo] }, createdAt: ago(18), reactions: { counts: { '🔥': 2 }, mine: null }
  },
  {
    itemId: 's|community-review', type: 'community_review', book: B.shadowWind,
    reviewer: { ...P.kwame, note: 'read 41 books this year' },
    review: { rating: 4, excerpt: 'A love letter to bookshops, with a gothic mystery folded inside it.' },
    createdAt: ago(20), reactions: { counts: { '📚': 6 }, mine: null }
  },
  {
    itemId: 's|wren-1', type: 'book_added', actor: P.wren, book: B.rebecca, shelf: 'Want to Read', createdAt: ago(22), reactions: none()
  },
  {
    itemId: 's|wren-2', type: 'book_added', actor: P.wren, book: B.babel, shelf: 'Want to Read', createdAt: ago(23), reactions: none()
  },
  {
    itemId: 's|wren-3', type: 'book_added', actor: P.wren, book: B.starlessSea, shelf: 'Want to Read', createdAt: ago(24.5), reactions: none()
  },
  {
    itemId: 's|finished', type: 'finished_book', actor: P.priya, book: B.tomorrow, shelf: 'Finished',
    createdAt: ago(26), reactions: none()
  },
  {
    itemId: 's|twin', type: 'reader_match', actor: P.imogen,
    match: { shared: 14, because: 'You both shelve dark academia and gothic fiction, and gave Rebecca five stars.', books: [B.rebecca, B.secretHistory, B.piranesi] },
    createdAt: ago(30)
  },
  {
    itemId: 's|release', type: 'new_release', book: B.remains, note: 'An author on your Finished shelf has a new edition out.',
    createdAt: ago(40)
  },
  {
    itemId: 's|goal', type: 'goal_progress', milestone: { value: 18, target: 24, sub: 'Six to go, and about ten weeks left in the year.' },
    createdAt: ago(46)
  },
  {
    itemId: 's|recap', type: 'year_recap',
    recap: {
      year: new Date().getFullYear(),
      stats: [{ label: 'Books', value: 31 }, { label: 'Pages', value: '9,840' }, { label: 'Top genre', value: 'Gothic' }],
      standout: 'Most-loved: Circe. Longest: The Secret History.'
    },
    createdAt: ago(48)
  },
  {
    itemId: 's|added', type: 'book_added', actor: P.leo, book: B.piranesi, shelf: 'Want to Read',
    createdAt: ago(50), reactions: { counts: { '📚': 3 }, mine: '📚' }
  },
  {
    itemId: 's|added-theo', type: 'book_added', actor: P.theo, book: B.piranesi, shelf: 'Want to Read',
    createdAt: ago(53), reactions: none()
  },
  {
    itemId: 's|added-nora', type: 'book_added', actor: P.nora, book: B.piranesi, shelf: 'Want to Read',
    createdAt: ago(60), reactions: none()
  },
  {
    itemId: 's|added-imogen', type: 'book_added', actor: P.imogen, book: B.remains, shelf: 'Want to Read',
    createdAt: ago(66), reactions: { counts: { '❤️': 1 }, mine: null }
  },
  {
    itemId: 's|milestone', type: 'milestone', milestone: { text: 'Your 50th finished book', sub: 'It was The Remains of the Day. Not a bad one to land on.' },
    createdAt: ago(70)
  }
];
