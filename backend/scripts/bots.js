// Bot readers: test content for seeing Pagebound with other people in it.
//
// Bots are ordinary profile rows whose userId starts with "bot-" (they can't
// sign in). The Lambdas hide them from everyone except accounts with
// showBots on their profile, so real readers never see them.
//
//   node backend/scripts/bots.js seed           create the bots and their history
//   node backend/scripts/bots.js on <email>     show bots to that account, make Margot
//                                               their friend, start a session with them
//   node backend/scripts/bots.js poke [email]   the bots do a few new things now
//                                               (all bot-enabled accounts if no email)
//   node backend/scripts/bots.js off <email>    hide bots again and undo "on"
//   node backend/scripts/bots.js status         who's a bot, who sees them
//   node backend/scripts/bots.js remove         "off" for everyone, then delete all bot data
//
// Uses your AWS CLI credentials. Deletes only bot rows, and rows on a real
// account that this script made (tagged createdBy: 'bots').
const path = require('path');
const { randomUUID } = require('crypto');

const sdk = (name) => require(require.resolve(name, { paths: [path.join(__dirname, '../lambda')] }));
const { DynamoDBClient } = sdk('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand, ScanCommand, BatchWriteCommand
} = sdk('@aws-sdk/lib-dynamodb');

const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-2' }));

const T = {
  users: 'pagebound-users',
  library: 'pagebound-library',
  shelves: 'pagebound-shelves',
  activity: 'pagebound-activity',
  reviews: 'pagebound-reviews',
  reactions: 'pagebound-reactions',
  friends: 'pagebound-friends',
  recs: 'pagebound-recommendations',
  sessions: 'pagebound-sessions',
  members: 'pagebound-session-members',
  messages: 'pagebound-messages'
};
const KEYS = {
  [T.users]: ['email'],
  [T.library]: ['userId', 'isbn'],
  [T.shelves]: ['userId', 'shelfId'],
  [T.activity]: ['actorId', 'sk'],
  [T.reviews]: ['isbn', 'userId'],
  [T.reactions]: ['itemId', 'userId'],
  [T.friends]: ['userId', 'friendUserId'],
  [T.recs]: ['toUserId', 'sk'],
  [T.sessions]: ['sessionId'],
  [T.members]: ['userId', 'sessionId'],
  [T.messages]: ['messageId']
};

const BOT_DOMAIN = '@bots.pagebound.invalid';
const isBot = (userId) => String(userId || '').startsWith('bot-');
const hoursAgo = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// ---------------------------------------------------------------- cast
const BOTS = [
  { id: 'bot-margot', username: 'margot.reads', displayName: 'Margot', tagline: 'Gothic fiction and too much tea.' },
  { id: 'bot-felix', username: 'felix_pages', displayName: 'Felix', tagline: 'Sci-fi first, questions later.' },
  { id: 'bot-odette', username: 'odette.m', displayName: 'Odette', tagline: 'Rereader. Annotator. Menace.' },
  { id: 'bot-kwame', username: 'kwame.b', displayName: 'Kwame', tagline: 'One book a week, mostly.' },
  { id: 'bot-lucia', username: 'lucia.v', displayName: 'Lucía', tagline: 'Translated fiction and long walks.' },
  { id: 'bot-theo', username: 'theo.inkwell', displayName: 'Theo', tagline: 'Dark academia, unapologetically.' }
];
const FRIEND_BOT = 'bot-margot';
const bot = (id) => BOTS.find(b => b.id === id);
const emailOf = (b) => `${b.id.slice(4)}${BOT_DOMAIN}`;

const cover = (isbn) => `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`;
const book = (isbn, title, author, chapters) => ({ isbn, title, author, coverUrl: cover(isbn), chapters });
const BOOKS = {
  starless: book('9780385541213', 'The Starless Sea', 'Erin Morgenstern', 40),
  nightCircus: book('9780385534635', 'The Night Circus', 'Erin Morgenstern', 15),
  piranesi: book('9781635575637', 'Piranesi', 'Susanna Clarke', 7),
  circe: book('9780316556347', 'Circe', 'Madeline Miller', 27),
  secretHistory: book('9781400031702', 'The Secret History', 'Donna Tartt', 8),
  shadow: book('9780143034902', 'The Shadow of the Wind', 'Carlos Ruiz Zafón', 30),
  rebecca: book('9780380730407', 'Rebecca', 'Daphne du Maurier', 27),
  villains: book('9781250095282', 'If We Were Villains', 'M. L. Rio', 5),
  babel: book('9780063021426', 'Babel', 'R. F. Kuang', 33),
  remains: book('9780679731726', 'The Remains of the Day', 'Kazuo Ishiguro', 8),
  hailMary: book('9780593135204', 'Project Hail Mary', 'Andy Weir', 30),
  mexicanGothic: book('9780525620785', 'Mexican Gothic', 'Silvia Moreno-Garcia', 27),
  tomorrow: book('9780593321201', 'Tomorrow, and Tomorrow, and Tomorrow', 'Gabrielle Zevin', 10)
};
const card = ({ isbn, title, author, coverUrl }) => ({ isbn, title, author, coverUrl });

// Seeded history: [bot, hours ago, what, book, extra]
const HISTORY = [
  ['bot-felix', 20, 'started', 'starless'],
  ['bot-odette', 30, 'added', 'starless'],
  ['bot-kwame', 50, 'started', 'starless'],
  ['bot-lucia', 8, 'reviewed', 'piranesi', { rating: 5, text: 'A house of tides and statues, and a narrator so gentle it hurts. Read it slowly.' }],
  ['bot-kwame', 26, 'reviewed', 'shadow', { rating: 4, text: 'A love letter to bookshops with a gothic mystery folded inside it.' }],
  ['bot-odette', 70, 'finished', 'rebecca'],
  ['bot-theo', 3, 'started', 'villains'],
  ['bot-felix', 100, 'reviewed', 'babel', { rating: 4, text: 'Brilliant and furious. The footnotes are half the fun.' }],
  ['bot-margot', 48, 'started', 'mexicanGothic'],
  ['bot-margot', 120, 'reviewed', 'circe', { rating: 5, text: 'A goddess learning to be a person. I cried on the train. Twice.' }],
  ['bot-margot', 10, 'added', 'secretHistory']
];

const MARGOT_COMMENTS = [
  'The way the tents are described, I can smell the caramel.',
  'Celia and Marco are going to ruin me, I can tell.',
  'Okay, that clock. THAT CLOCK.',
  'I had to put it down for a minute after this chapter.',
  'Bailey is quietly my favourite person in this book.',
  'Every time Tsukiko shows up I sit up straighter.',
  'I think I finally understand the rules of the challenge. Maybe.',
  'This chapter felt like walking through the circus at night.'
];
const RECOMMENDATION_NOTES = [
  'You have to read this one, it has the same feeling as the circus.',
  'Saw this and thought of you immediately.',
  'Short, strange and perfect for a rainy weekend.'
];

// ---------------------------------------------------------------- db helpers
async function scanAll(TableName, filter = () => true) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const page = await db.send(new ScanCommand({ TableName, ExclusiveStartKey }));
    items.push(...(page.Items || []).filter(filter));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

const queryAll = async (params) => (await db.send(new QueryCommand(params))).Items || [];
const put = (TableName, Item) => db.send(new PutCommand({ TableName, Item }));

async function deleteAll(TableName, items) {
  const keys = items.map(i => Object.fromEntries(KEYS[TableName].map(k => [k, i[k]])));
  for (let i = 0; i < keys.length; i += 25) {
    await db.send(new BatchWriteCommand({
      RequestItems: { [TableName]: keys.slice(i, i + 25).map(Key => ({ DeleteRequest: { Key } })) }
    }));
  }
  return keys.length;
}

async function profileByEmail(email) {
  const found = (await db.send(new GetCommand({ TableName: T.users, Key: { email: String(email).toLowerCase() } }))).Item;
  if (!found) throw new Error(`No profile for ${email}`);
  return found;
}

async function activity(actorId, type, createdAt, data) {
  await put(T.activity, { actorId, sk: `${createdAt}#${randomUUID()}`, type, createdAt, createdBy: 'bots', ...data });
}

async function shelveBook(userId, b, shelf, extra = {}) {
  const now = new Date().toISOString();
  await put(T.library, {
    userId, isbn: b.isbn, title: b.title, author: b.author, coverUrl: b.coverUrl,
    shelf, shelves: [], currentChapter: 0, totalChapters: b.chapters || 0, currentPage: 0, totalPages: 0,
    progress: 0, rating: 0, addedAt: now, lastReadAt: now, createdBy: 'bots', ...extra
  });
}

async function review(userId, b, rating, text, createdAt) {
  await put(T.reviews, { isbn: b.isbn, userId, rating, text, book: card(b), createdAt, updatedAt: createdAt, createdBy: 'bots' });
  await activity(userId, 'book_reviewed', createdAt, { book: card(b), review: { rating, excerpt: text.slice(0, 240) } });
}

// One bot action, as the app would record it
async function act(botId, what, b, at, extra = {}) {
  if (what === 'started') {
    await shelveBook(botId, b, 'Currently Reading');
    await activity(botId, 'started_reading', at, { book: card(b), shelf: 'Currently Reading' });
  } else if (what === 'added') {
    await shelveBook(botId, b, 'Want to Read');
    await activity(botId, 'book_added', at, { book: card(b), shelf: 'Want to Read' });
  } else if (what === 'finished') {
    await shelveBook(botId, b, 'Finished', { currentChapter: b.chapters || 0, progress: 100 });
    await activity(botId, 'finished_book', at, { book: card(b), shelf: 'Finished' });
  } else if (what === 'reviewed') {
    await shelveBook(botId, b, 'Finished', { currentChapter: b.chapters || 0, progress: 100, rating: extra.rating });
    await activity(botId, 'finished_book', at, { book: card(b), shelf: 'Finished' });
    await review(botId, b, extra.rating, extra.text, at);
  }
}

// ---------------------------------------------------------------- commands
async function seed() {
  const existing = await scanAll(T.users, u => isBot(u.userId));
  if (existing.length) {
    console.log(`Bots already exist (${existing.length}). Use "poke" for new activity, or "remove" first.`);
    return;
  }
  const createdAt = hoursAgo(24 * 30);
  for (const b of BOTS) {
    await put(T.users, {
      email: emailOf(b), userId: b.id, username: b.username, displayName: b.displayName,
      tagline: b.tagline, bio: '', avatarUrl: null, isPrivate: false, isAdmin: false, isBot: true,
      createdAt, friendsCount: 0, publicShelves: []
    });
  }
  for (const [botId, hours, what, key, extra] of HISTORY) {
    await act(botId, what, BOOKS[key], hoursAgo(hours), extra);
  }
  console.log(`Seeded ${BOTS.length} bots and ${HISTORY.length} things they did.`);
}

async function on(email) {
  const me = await profileByEmail(email);
  const margot = bot(FRIEND_BOT);
  const now = new Date().toISOString();

  await db.send(new UpdateCommand({
    TableName: T.users, Key: { email: me.email },
    UpdateExpression: 'SET showBots = :t', ConditionExpression: 'attribute_exists(email)',
    ExpressionAttributeValues: { ':t': true }
  }));

  const friendRow = (userId, friend) => ({
    userId, friendUserId: friend.userId, status: 'accepted', createdAt: now, createdBy: 'bots',
    friendUsername: friend.username, friendDisplayName: friend.displayName || friend.username, friendAvatarUrl: friend.avatarUrl || null
  });
  await put(T.friends, friendRow(me.userId, { userId: margot.id, username: margot.username, displayName: margot.displayName }));
  await put(T.friends, friendRow(margot.id, me));

  // A session with Margot, unless they already share one for this book
  const b = BOOKS.nightCircus;
  const mine = await queryAll({ TableName: T.members, KeyConditionExpression: 'userId = :u', ExpressionAttributeValues: { ':u': me.userId } });
  if (mine.some(m => m.bookIsbn === b.isbn)) {
    console.log(`${email} already has a session for ${b.title}; skipping the session.`);
  } else {
    const sessionId = `bot-session-${randomUUID()}`;
    const start = hoursAgo(30);
    const participant = (userId, isHost, currentChapter) => ({ userId, isHost, currentChapter, currentPage: 0, joinedAt: start });
    const lastMessageAt = hoursAgo(2);
    await put(T.sessions, {
      sessionId, sessionName: 'Le Cirque des Rêves', bookTitle: b.title, bookAuthor: b.author, bookCover: b.coverUrl,
      bookIsbn: b.isbn, totalChapters: b.chapters, totalPages: null, trackingMode: 'chapters', hostUserId: margot.id,
      participants: [participant(margot.id, true, 4), participant(me.userId, false, 0)],
      createdAt: start, updatedAt: lastMessageAt, lastMessageAt, createdBy: 'bots'
    });
    await put(T.members, { userId: margot.id, sessionId, bookIsbn: b.isbn, joinedAt: start, lastSeenAt: lastMessageAt, createdBy: 'bots' });
    // No lastSeenAt: shows as a new invitation
    await put(T.members, { userId: me.userId, sessionId, bookIsbn: b.isbn, joinedAt: start, createdBy: 'bots' });
    const say = (position, message, at) => put(T.messages, {
      messageId: `bot-${randomUUID()}`, sessionId, userId: margot.id, username: margot.username, displayName: margot.displayName,
      avatarUrl: null, message, position, chapterNumber: position, unit: 'chapters', createdAt: at, readBy: { [margot.id]: at }, createdBy: 'bots'
    });
    await say(0, 'Starting tonight! Fair warning, I read fast.', hoursAgo(29));
    await say(2, MARGOT_COMMENTS[0], hoursAgo(12));
    await say(4, MARGOT_COMMENTS[2], lastMessageAt);
    await activity(margot.id, 'session_started', start, { book: card(b), session: { readers: 2, trackingMode: 'chapters' } });

    const shelved = (await db.send(new GetCommand({ TableName: T.library, Key: { userId: me.userId, isbn: b.isbn } }))).Item;
    if (!shelved) await shelveBook(me.userId, b, 'Currently Reading');
  }

  await put(T.recs, {
    toUserId: me.userId, sk: `${hoursAgo(5)}#${randomUUID()}`, fromUserId: margot.id, book: card(BOOKS.piranesi),
    note: RECOMMENDATION_NOTES[0], createdAt: hoursAgo(5), createdBy: 'bots'
  });
  console.log(`Bots on for ${email}: Margot is a friend, with a session and a recommendation.`);
}

async function off(email) {
  const me = await profileByEmail(email);
  await db.send(new UpdateCommand({ TableName: T.users, Key: { email: me.email }, UpdateExpression: 'REMOVE showBots' }));

  const friendships = await queryAll({ TableName: T.friends, KeyConditionExpression: 'userId = :u', ExpressionAttributeValues: { ':u': me.userId } });
  const botFriends = friendships.filter(f => isBot(f.friendUserId));
  await deleteAll(T.friends, [...botFriends, ...botFriends.map(f => ({ userId: f.friendUserId, friendUserId: me.userId }))]);

  const memberships = await queryAll({ TableName: T.members, KeyConditionExpression: 'userId = :u', ExpressionAttributeValues: { ':u': me.userId } });
  for (const m of memberships.filter(m => String(m.sessionId).startsWith('bot-session-'))) await deleteSession(m.sessionId);

  const recs = await queryAll({ TableName: T.recs, KeyConditionExpression: 'toUserId = :u', ExpressionAttributeValues: { ':u': me.userId } });
  await deleteAll(T.recs, recs.filter(r => isBot(r.fromUserId)));

  const books = await queryAll({ TableName: T.library, KeyConditionExpression: 'userId = :u', ExpressionAttributeValues: { ':u': me.userId } });
  await deleteAll(T.library, books.filter(b => b.createdBy === 'bots'));
  console.log(`Bots off for ${email}.`);
}

async function deleteSession(sessionId) {
  const session = (await db.send(new GetCommand({ TableName: T.sessions, Key: { sessionId } }))).Item;
  if (!session || !isBot(session.hostUserId)) return;
  const messages = await queryAll({
    TableName: T.messages, IndexName: 'sessionId-index',
    KeyConditionExpression: 'sessionId = :s', ExpressionAttributeValues: { ':s': sessionId }
  });
  await deleteAll(T.messages, messages);
  await deleteAll(T.members, session.participants.map(p => ({ userId: p.userId, sessionId })));
  await deleteAll(T.sessions, [{ sessionId }]);
}

async function poke(email) {
  const accounts = email ? [await profileByEmail(email)] : await scanAll(T.users, u => u.showBots);
  if (!accounts.length) console.log('No accounts have bots on.');
  const margot = bot(FRIEND_BOT);
  const now = new Date().toISOString();
  const happened = [];

  // Margot moves on in each session she shares, and says something
  for (const me of accounts) {
    const memberships = await queryAll({ TableName: T.members, KeyConditionExpression: 'userId = :u', ExpressionAttributeValues: { ':u': me.userId } });
    for (const m of memberships.filter(m => String(m.sessionId).startsWith('bot-session-'))) {
      const session = (await db.send(new GetCommand({ TableName: T.sessions, Key: { sessionId: m.sessionId } }))).Item;
      if (!session) continue;
      const her = session.participants.find(p => p.userId === margot.id);
      const total = session.totalChapters || 1;
      if (her.currentChapter >= total) continue;
      her.currentChapter = Math.min(total, her.currentChapter + 1 + Math.floor(Math.random() * 2));
      await db.send(new UpdateCommand({
        TableName: T.sessions, Key: { sessionId: session.sessionId },
        UpdateExpression: 'SET participants = :p, updatedAt = :now, lastMessageAt = :now',
        ExpressionAttributeValues: { ':p': session.participants, ':now': now }
      }));
      await put(T.messages, {
        messageId: `bot-${randomUUID()}`, sessionId: session.sessionId, userId: margot.id, username: margot.username,
        displayName: margot.displayName, avatarUrl: null, message: pick(MARGOT_COMMENTS), position: her.currentChapter,
        chapterNumber: her.currentChapter, unit: 'chapters', createdAt: now, readBy: { [margot.id]: now }, createdBy: 'bots'
      });
      happened.push(`Margot reached chapter ${her.currentChapter} of ${session.bookTitle} and left a comment`);
    }
    if (Math.random() < 0.35) {
      const b = pick([BOOKS.remains, BOOKS.tomorrow, BOOKS.villains, BOOKS.rebecca]);
      await put(T.recs, { toUserId: me.userId, sk: `${now}#${randomUUID()}`, fromUserId: margot.id, book: card(b), note: pick(RECOMMENDATION_NOTES), createdAt: now, createdBy: 'bots' });
      happened.push(`Margot recommended ${b.title} to ${me.username}`);
    }
  }

  // Two public bots do something
  const publicBots = BOTS.filter(b => b.id !== FRIEND_BOT).sort(() => Math.random() - 0.5).slice(0, 2);
  for (const b of publicBots) {
    const shelf = await queryAll({ TableName: T.library, KeyConditionExpression: 'userId = :u', ExpressionAttributeValues: { ':u': b.id } });
    const reading = shelf.filter(x => x.shelf === 'Currently Reading');
    const unread = Object.values(BOOKS).filter(x => !shelf.some(s => s.isbn === x.isbn));
    if (reading.length && Math.random() < 0.5) {
      const x = Object.values(BOOKS).find(k => k.isbn === pick(reading).isbn);
      const rating = 3 + Math.floor(Math.random() * 3);
      await act(b.id, 'reviewed', x, now, { rating, text: pick(['Couldn\'t put it down.', 'Slow start, wonderful ending.', 'Not what I expected, in the best way.', 'Already want to reread it.']) });
      happened.push(`${b.displayName} finished and reviewed ${x.title} (${rating}★)`);
    } else if (unread.length) {
      const x = pick(unread);
      const what = Math.random() < 0.6 ? 'started' : 'added';
      await act(b.id, what, x, now);
      happened.push(`${b.displayName} ${what === 'started' ? 'started' : 'shelved'} ${x.title}`);
    }
  }
  happened.forEach(h => console.log(`  • ${h}`));
}

async function status() {
  const users = await scanAll(T.users);
  console.log('Bots:', users.filter(u => isBot(u.userId)).map(u => `${u.displayName} (@${u.username})`).join(', ') || 'none');
  console.log('Bots on for:', users.filter(u => u.showBots).map(u => u.email).join(', ') || 'nobody');
}

async function remove() {
  for (const u of await scanAll(T.users, u => u.showBots)) await off(u.email);
  const counts = {
    sessions: 0,
    users: await deleteAll(T.users, await scanAll(T.users, u => isBot(u.userId))),
    library: await deleteAll(T.library, await scanAll(T.library, i => isBot(i.userId))),
    shelves: await deleteAll(T.shelves, await scanAll(T.shelves, i => isBot(i.userId))),
    activity: await deleteAll(T.activity, await scanAll(T.activity, i => isBot(i.actorId))),
    reviews: await deleteAll(T.reviews, await scanAll(T.reviews, i => isBot(i.userId))),
    reactions: await deleteAll(T.reactions, await scanAll(T.reactions, i => isBot(i.userId) || String(i.itemId).startsWith('a|bot-'))),
    friends: await deleteAll(T.friends, await scanAll(T.friends, i => isBot(i.userId) || isBot(i.friendUserId))),
    recommendations: await deleteAll(T.recs, await scanAll(T.recs, i => isBot(i.fromUserId)))
  };
  for (const s of await scanAll(T.sessions, s => isBot(s.hostUserId))) {
    await deleteSession(s.sessionId);
    counts.sessions++;
  }
  console.log('Removed:', counts);
}

const [command, arg] = process.argv.slice(2);
const commands = { seed, on, off, poke, status, remove };
if (!commands[command] || (['on', 'off'].includes(command) && !arg)) {
  console.log('Usage: node backend/scripts/bots.js seed | on <email> | poke [email] | off <email> | status | remove');
  process.exit(1);
}
commands[command](arg).catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
