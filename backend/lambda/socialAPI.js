// socialAPI Lambda Function
// Home feed, reactions, book recommendations and reviews.
//
// Every request is authenticated by the API Gateway Cognito authorizer; the
// caller is claims.sub.
//
// Tables
//   ACTIVITY_TABLE         actorId (HASH), sk (RANGE "<createdAt>#<uuid>")
//                          written by the library and sessions Lambdas
//   RECOMMENDATIONS_TABLE  toUserId (HASH), sk (RANGE "<createdAt>#<uuid>")
//   REACTIONS_TABLE        itemId (HASH), userId (RANGE), emoji
//   FRIENDS_TABLE          userId (HASH), friendUserId (RANGE)
//   SHELVES_TABLE          userId (HASH), shelfId (RANGE) – shelf visibility
//   USERS_TABLE            GSI userId-index
//   REVIEWS_TABLE          isbn (HASH), userId (RANGE); GSI userId-index (userId, updatedAt)
//   LIBRARY_TABLE          reviewing a book also sets its rating in your library
//
// Feed items are identified as "a|<actorId>|<sk>" (activity),
// "r|<toUserId>|<sk>" (recommendation) or "t|<isbn>|<week>" (trending).
//
// The feed mixes friends' activity with everyone else's ("Around Pagebound",
// audience: 'community'). Readers leave the public feed by making their
// profile private; private shelves stay out of it too.
//
// Bot readers (userId "bot-...") are test content: only accounts with
// showBots on their profile ever see them. See backend/scripts/bots.js.

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, QueryCommand, UpdateCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require('crypto');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const ACTIVITY_TABLE = process.env.ACTIVITY_TABLE || 'pagebound-activity';
const RECOMMENDATIONS_TABLE = process.env.RECOMMENDATIONS_TABLE || 'pagebound-recommendations';
const REACTIONS_TABLE = process.env.REACTIONS_TABLE || 'pagebound-reactions';
const FRIENDS_TABLE = process.env.FRIENDS_TABLE || 'pagebound-friends';
const SHELVES_TABLE = process.env.SHELVES_TABLE || 'pagebound-shelves';
const USERS_TABLE = process.env.USERS_TABLE || 'pagebound-users';
const REVIEWS_TABLE = process.env.REVIEWS_TABLE || 'pagebound-reviews';
const LIBRARY_TABLE = process.env.LIBRARY_TABLE || 'pagebound-library';
const MAX_REVIEW = 2000;
const ANONYMOUS = { userId: null, username: null, displayName: 'A Pagebound reader', avatarUrl: null, isPrivate: true };

const REACTIONS = ['❤️', '🔥', '😂', '😮', '📚'];
const FEED_DAYS = 30;
const PER_FRIEND = 20;
const FEED_LIMIT = 50;
const COMMUNITY_DAYS = 14;
const COMMUNITY_LIMIT = 25;
const TRENDING_DAYS = 7;
const TRENDING_MIN_READERS = 3;
const TRENDING_LIMIT = 2;

// Status shelf an activity type belongs to (for visibility checks)
const STATUS_SHELF_IDS = {
  'Currently Reading': 'currently-reading',
  'Want to Read': 'want-to-read',
  'Finished': 'finished',
  'Read': 'finished'
};

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const json = (statusCode, body) => ({ statusCode, body: JSON.stringify(body) });

function getCallerId(event) {
  const callerId = event.requestContext?.authorizer?.claims?.sub;
  if (!callerId) throw new HttpError(401, 'Not signed in');
  return callerId;
}

function parseBody(event) {
  try {
    return event.body ? JSON.parse(event.body) : {};
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}

const query = async (params) => (await dynamodb.send(new QueryCommand(params))).Items || [];

const isBot = (userId) => String(userId || '').startsWith('bot-');

async function seesBots(userId) {
  const items = await query({
    TableName: USERS_TABLE,
    IndexName: 'userId-index',
    KeyConditionExpression: 'userId = :u',
    ExpressionAttributeValues: { ':u': userId }
  });
  return !!items[0]?.showBots;
}

async function friendIdsOf(userId) {
  const items = await query({
    TableName: FRIENDS_TABLE,
    KeyConditionExpression: 'userId = :u',
    ExpressionAttributeValues: { ':u': userId }
  });
  return items.map(f => f.friendUserId);
}

async function areFriends(a, b) {
  const result = await dynamodb.send(new GetCommand({ TableName: FRIENDS_TABLE, Key: { userId: a, friendUserId: b } }));
  return !!result.Item;
}

async function userCard(userId) {
  const items = await query({
    TableName: USERS_TABLE,
    IndexName: 'userId-index',
    KeyConditionExpression: 'userId = :u',
    ExpressionAttributeValues: { ':u': userId }
  });
  const user = items[0];
  return {
    userId,
    username: user?.username || 'Reader',
    displayName: user?.displayName || user?.username || 'Reader',
    avatarUrl: user?.avatarUrl || null,
    isPrivate: !!user?.isPrivate
  };
}

// Shelf ids the user has made private
async function privateShelvesOf(userId) {
  const items = await query({
    TableName: SHELVES_TABLE,
    KeyConditionExpression: 'userId = :u',
    ExpressionAttributeValues: { ':u': userId }
  });
  return new Set(items.filter(s => s.visibility === 'private').map(s => s.shelfId));
}

// Is a friend's activity visible given their current privacy settings?
function activityVisible(activity, actor, privateShelves) {
  if (actor.isPrivate) return false;
  const shelfId = STATUS_SHELF_IDS[activity.shelf];
  return !(shelfId && privateShelves.has(shelfId));
}

async function reactionsFor(itemId, callerId) {
  const items = await query({
    TableName: REACTIONS_TABLE,
    KeyConditionExpression: 'itemId = :i',
    ExpressionAttributeValues: { ':i': itemId }
  });
  const counts = {};
  items.forEach(r => { counts[r.emoji] = (counts[r.emoji] || 0) + 1; });
  return { counts, mine: items.find(r => r.userId === callerId)?.emoji || null };
}

const daysAgo = (days) => new Date(Date.now() - days * 864e5).toISOString();

// Everyone's activity since a date. A scan is fine while the network is
// small; past a few thousand readers, add a time-ordered index instead.
async function recentActivity(since) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const page = await dynamodb.send(new ScanCommand({
      TableName: ACTIVITY_TABLE,
      FilterExpression: 'sk > :since',
      ExpressionAttributeValues: { ':since': since },
      ExclusiveStartKey
    }));
    items.push(...(page.Items || []));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

const activityItem = (item, actor, extra = {}) => ({
  itemId: `a|${item.actorId}|${item.sk}`,
  kind: 'activity',
  type: item.type,
  actor,
  book: item.book || null,
  shelf: item.shelf || null,
  session: item.session || null,
  review: item.review || null,
  createdAt: item.createdAt,
  ...extra
});

// "Around Pagebound": public readers who aren't the caller's friends, plus
// books several readers picked up this week
async function communityItems(callerId, friendIds) {
  const showBots = await seesBots(callerId);
  const friends = new Set(friendIds);
  const recent = await recentActivity(daysAgo(COMMUNITY_DAYS));

  const actorIds = [...new Set(recent.map(a => a.actorId))]
    .filter(id => id !== callerId && (showBots || !isBot(id)));
  const readers = Object.fromEntries(await Promise.all(actorIds.map(async (id) => {
    const [actor, privateShelves] = await Promise.all([userCard(id), privateShelvesOf(id)]);
    return [id, { actor, privateShelves }];
  })));
  const visible = recent.filter(a => readers[a.actorId] &&
    activityVisible(a, readers[a.actorId].actor, readers[a.actorId].privateShelves));

  const community = visible
    .filter(a => !friends.has(a.actorId))
    .sort((a, b) => b.sk.localeCompare(a.sk))
    .slice(0, COMMUNITY_LIMIT)
    .map(a => activityItem(a, readers[a.actorId].actor, { audience: 'community' }));

  // Trending: distinct readers (friends included) who started or shelved a book
  const weekStart = daysAgo(TRENDING_DAYS);
  const byBook = {};
  visible
    .filter(a => a.sk > weekStart && ['started_reading', 'book_added'].includes(a.type) && a.book?.isbn)
    .forEach(a => {
      const entry = byBook[a.book.isbn] = byBook[a.book.isbn] || { book: a.book, readers: new Set(), latest: '' };
      entry.readers.add(a.actorId);
      if (a.createdAt > entry.latest) entry.latest = a.createdAt;
    });
  const trending = Object.values(byBook)
    .filter(t => t.readers.size >= TRENDING_MIN_READERS)
    .sort((a, b) => b.readers.size - a.readers.size || b.latest.localeCompare(a.latest))
    .slice(0, TRENDING_LIMIT)
    .map(t => ({
      itemId: `t|${t.book.isbn}|${weekStart.slice(0, 10)}`,
      kind: 'trending',
      type: 'trending',
      audience: 'community',
      book: t.book,
      count: t.readers.size,
      faces: [...t.readers].slice(0, 3).map(id => readers[id].actor),
      othersCount: t.readers.size,
      createdAt: t.latest
    }));

  return [...community, ...trending];
}

// GET /feed – friends' recent activity, recommendations to the caller, and
// what everyone else is reading
async function getFeed(event, callerId) {
  const since = daysAgo(FEED_DAYS);
  const friendIds = await friendIdsOf(callerId);

  const activity = (await Promise.all(friendIds.map(async (actorId) => {
    const [actor, privateShelves, items] = await Promise.all([
      userCard(actorId),
      privateShelvesOf(actorId),
      query({
        TableName: ACTIVITY_TABLE,
        KeyConditionExpression: 'actorId = :a AND sk > :since',
        ExpressionAttributeValues: { ':a': actorId, ':since': since },
        ScanIndexForward: false,
        Limit: PER_FRIEND
      })
    ]);
    return items
      .filter(item => activityVisible(item, actor, privateShelves))
      .map(item => activityItem(item, actor));
  }))).flat();

  const recs = await query({
    TableName: RECOMMENDATIONS_TABLE,
    KeyConditionExpression: 'toUserId = :u AND sk > :since',
    ExpressionAttributeValues: { ':u': callerId, ':since': since },
    ScanIndexForward: false,
    Limit: PER_FRIEND
  });
  const recommendations = await Promise.all(recs.map(async (r) => ({
    itemId: `r|${callerId}|${r.sk}`,
    kind: 'recommendation',
    type: 'recommendation',
    actor: await userCard(r.fromUserId),
    book: r.book,
    note: r.note || '',
    createdAt: r.createdAt
  })));

  const items = [...activity, ...recommendations, ...(await communityItems(callerId, friendIds))]
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, FEED_LIMIT);

  const withReactions = await Promise.all(items.map(async (item) => (
    item.kind === 'trending' ? item : { ...item, reactions: await reactionsFor(item.itemId, callerId) }
  )));

  return json(200, { items: withReactions, reactionSet: REACTIONS });
}

// Can the caller see (and so react to) this feed item?
async function assertCanSee(itemId, callerId) {
  const [kind, ownerId, sk] = itemId.split('|');
  if (!sk || !['a', 'r'].includes(kind)) throw new HttpError(400, 'Unknown item');

  if (kind === 'a') {
    const found = await dynamodb.send(new GetCommand({ TableName: ACTIVITY_TABLE, Key: { actorId: ownerId, sk } }));
    if (!found.Item) throw new HttpError(404, 'Item not found');
    if (ownerId === callerId || (await areFriends(callerId, ownerId))) return;
    // Anyone can react to a public reader's activity (bots only if they're shown)
    const owner = await userCard(ownerId);
    if (owner.isPrivate || (isBot(ownerId) && !(await seesBots(callerId)))) throw new HttpError(403, 'Not visible to you');
  } else {
    const found = await dynamodb.send(new GetCommand({ TableName: RECOMMENDATIONS_TABLE, Key: { toUserId: ownerId, sk } }));
    if (!found.Item) throw new HttpError(404, 'Item not found');
    if (![found.Item.toUserId, found.Item.fromUserId].includes(callerId)) throw new HttpError(403, 'Not visible to you');
  }
}

// PUT /feed/items/{itemId}/reactions  { emoji } – set, change, or clear (emoji: null)
async function setReaction(event, callerId) {
  const itemId = decodeURIComponent(event.pathParameters?.itemId || '');
  const { emoji } = parseBody(event);
  if (emoji !== null && !REACTIONS.includes(emoji)) throw new HttpError(400, 'Pick one of the preset reactions');

  await assertCanSee(itemId, callerId);

  if (emoji === null) {
    await dynamodb.send(new DeleteCommand({ TableName: REACTIONS_TABLE, Key: { itemId, userId: callerId } }));
  } else {
    await dynamodb.send(new PutCommand({
      TableName: REACTIONS_TABLE,
      Item: { itemId, userId: callerId, emoji, createdAt: new Date().toISOString() }
    }));
  }
  return json(200, { reactions: await reactionsFor(itemId, callerId) });
}

// POST /recommendations  { toUserIds: [...], book: {isbn,title,author,coverUrl}, note }
async function recommend(event, callerId) {
  const { toUserIds = [], book = {}, note = '' } = parseBody(event);
  const recipients = [...new Set(toUserIds)].filter(id => id && id !== callerId);
  if (!recipients.length) throw new HttpError(400, 'Choose at least one friend');
  if (recipients.length > 20) throw new HttpError(400, 'Recommend to up to 20 friends at a time');
  if (!book.isbn || !book.title) throw new HttpError(400, 'Which book?');

  for (const id of recipients) {
    if (!(await areFriends(callerId, id))) throw new HttpError(403, 'You can only recommend books to friends');
  }

  const createdAt = new Date().toISOString();
  const cleanBook = {
    isbn: String(book.isbn).slice(0, 100),
    title: String(book.title).slice(0, 300),
    author: String(book.author || '').slice(0, 300),
    coverUrl: book.coverUrl ? String(book.coverUrl).slice(0, 1000) : null
  };
  await Promise.all(recipients.map(toUserId => dynamodb.send(new PutCommand({
    TableName: RECOMMENDATIONS_TABLE,
    Item: {
      toUserId,
      sk: `${createdAt}#${randomUUID()}`,
      fromUserId: callerId,
      book: cleanBook,
      note: String(note || '').trim().slice(0, 280),
      createdAt
    }
  }))));

  return json(201, { sent: recipients.length });
}

// ---------------------------------------------------------------- reviews

const reviewOut = (r, author) => ({
  isbn: r.isbn,
  book: r.book,
  rating: r.rating,
  text: r.text,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  author
});

// GET /books/{isbn}/reviews – every reader's review; private profiles are anonymous
async function bookReviews(event, callerId) {
  const isbn = decodeURIComponent(event.pathParameters?.isbn || '');
  const showBots = await seesBots(callerId);
  const items = (await query({
    TableName: REVIEWS_TABLE,
    KeyConditionExpression: 'isbn = :i',
    ExpressionAttributeValues: { ':i': isbn }
  })).filter(r => showBots || !isBot(r.userId));
  const reviews = await Promise.all(items.map(async (r) => {
    const author = await userCard(r.userId);
    return reviewOut(r, r.userId === callerId ? { ...author, isMe: true }
      : author.isPrivate ? ANONYMOUS : author);
  }));
  reviews.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const ratings = reviews.map(r => r.rating);

  return json(200, {
    reviews: reviews.filter(r => r.text),
    mine: reviews.find(r => r.author.isMe) || null,
    count: ratings.length,
    average: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null
  });
}

// PUT /books/{isbn}/reviews/mine  { rating 1-5, text, book: {title, author, coverUrl} }
async function saveReview(event, callerId) {
  const isbn = decodeURIComponent(event.pathParameters?.isbn || '');
  const { rating, text = '', book = {} } = parseBody(event);
  const stars = Number(rating);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new HttpError(400, 'Give the book 1 to 5 stars');
  const clean = String(text || '').trim();
  if (clean.length > MAX_REVIEW) throw new HttpError(400, `Reviews can be up to ${MAX_REVIEW} characters`);
  if (!isbn || !book.title) throw new HttpError(400, 'Which book?');

  const existing = await dynamodb.send(new GetCommand({ TableName: REVIEWS_TABLE, Key: { isbn, userId: callerId } }));
  const now = new Date().toISOString();
  const bookCard = {
    isbn,
    title: String(book.title).slice(0, 300),
    author: String(book.author || '').slice(0, 300),
    coverUrl: book.coverUrl ? String(book.coverUrl).slice(0, 1000) : null
  };
  const item = {
    isbn,
    userId: callerId,
    rating: stars,
    text: clean,
    book: bookCard,
    createdAt: existing.Item?.createdAt || now,
    updatedAt: now
  };
  await dynamodb.send(new PutCommand({ TableName: REVIEWS_TABLE, Item: item }));

  // Keep the library rating in step (only if the book is on the reader's shelves)
  try {
    await dynamodb.send(new UpdateCommand({
      TableName: LIBRARY_TABLE,
      Key: { userId: callerId, isbn },
      UpdateExpression: 'SET rating = :r',
      ConditionExpression: 'attribute_exists(isbn)',
      ExpressionAttributeValues: { ':r': stars }
    }));
  } catch (error) {
    if (error.name !== 'ConditionalCheckFailedException') console.error('Could not sync rating:', error);
  }

  // A new written review goes to friends' feeds
  if (!existing.Item && clean) {
    await dynamodb.send(new PutCommand({
      TableName: ACTIVITY_TABLE,
      Item: {
        actorId: callerId,
        sk: `${now}#${randomUUID()}`,
        type: 'book_reviewed',
        createdAt: now,
        book: bookCard,
        review: { rating: stars, excerpt: clean.slice(0, 240) }
      }
    }));
  }

  return json(200, { review: reviewOut(item, { ...(await userCard(callerId)), isMe: true }) });
}

// DELETE /books/{isbn}/reviews/mine
async function deleteReview(event, callerId) {
  const isbn = decodeURIComponent(event.pathParameters?.isbn || '');
  await dynamodb.send(new DeleteCommand({ TableName: REVIEWS_TABLE, Key: { isbn, userId: callerId } }));
  return json(200, { ok: true });
}

// GET /reviews/by/{userId} – a reader's reviews (yourself, or a friend with a public profile)
async function userReviews(event, callerId) {
  const userId = event.pathParameters?.userId;
  const author = await userCard(userId);
  if (userId !== callerId) {
    if (!(await areFriends(callerId, userId))) throw new HttpError(403, 'Only friends can see these reviews');
    if (author.isPrivate) return json(200, { isPrivate: true, reviews: [] });
  }
  const items = await query({
    TableName: REVIEWS_TABLE,
    IndexName: 'userId-index',
    KeyConditionExpression: 'userId = :u',
    ExpressionAttributeValues: { ':u': userId },
    ScanIndexForward: false
  });
  return json(200, { isPrivate: false, reviews: items.map(r => reviewOut(r, { ...author, isMe: userId === callerId })) });
}

const routes = [
  ['GET', /^\/feed$/, getFeed],
  ['PUT', /^\/feed\/items\/[^/]+\/reactions$/, setReaction],
  ['POST', /^\/recommendations$/, recommend],
  ['GET', /^\/books\/[^/]+\/reviews$/, bookReviews],
  ['PUT', /^\/books\/[^/]+\/reviews\/mine$/, saveReview],
  ['DELETE', /^\/books\/[^/]+\/reviews\/mine$/, deleteReview],
  ['GET', /^\/reviews\/by\/[^/]+$/, userReviews]
];

exports.handler = async (event) => {
  console.log('Request:', event.httpMethod, event.path);

  let response;
  try {
    const route = routes.find(([method, pattern]) => method === event.httpMethod && pattern.test(event.path));
    if (!route) throw new HttpError(404, 'Endpoint not found');
    response = await route[2](event, getCallerId(event));
  } catch (error) {
    if (error instanceof HttpError) {
      response = json(error.statusCode, { error: error.message });
    } else {
      console.error('Error:', error);
      response = json(500, { error: 'Something went wrong' });
    }
  }

  response.headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  };
  return response;
};
