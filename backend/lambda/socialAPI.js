// socialAPI Lambda Function
// Home feed, reactions and book recommendations.
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
//
// Feed items are identified as "a|<actorId>|<sk>" (activity) or
// "r|<toUserId>|<sk>" (recommendation).

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require('crypto');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const ACTIVITY_TABLE = process.env.ACTIVITY_TABLE || 'pagebound-activity';
const RECOMMENDATIONS_TABLE = process.env.RECOMMENDATIONS_TABLE || 'pagebound-recommendations';
const REACTIONS_TABLE = process.env.REACTIONS_TABLE || 'pagebound-reactions';
const FRIENDS_TABLE = process.env.FRIENDS_TABLE || 'pagebound-friends';
const SHELVES_TABLE = process.env.SHELVES_TABLE || 'pagebound-shelves';
const USERS_TABLE = process.env.USERS_TABLE || 'pagebound-users';

const REACTIONS = ['❤️', '🔥', '😂', '😮', '📚'];
const FEED_DAYS = 30;
const PER_FRIEND = 20;
const FEED_LIMIT = 50;

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

// GET /feed – friends' recent activity plus recommendations to the caller
async function getFeed(event, callerId) {
  const since = new Date(Date.now() - FEED_DAYS * 864e5).toISOString();
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
      .map(item => ({
        itemId: `a|${actorId}|${item.sk}`,
        kind: 'activity',
        type: item.type,
        actor,
        book: item.book || null,
        shelf: item.shelf || null,
        session: item.session || null,
        createdAt: item.createdAt
      }));
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

  const items = [...activity, ...recommendations]
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, FEED_LIMIT);

  const withReactions = await Promise.all(items.map(async (item) => ({
    ...item,
    reactions: await reactionsFor(item.itemId, callerId)
  })));

  return json(200, { items: withReactions, reactionSet: REACTIONS });
}

// Can the caller see (and so react to) this feed item?
async function assertCanSee(itemId, callerId) {
  const [kind, ownerId, sk] = itemId.split('|');
  if (!sk || !['a', 'r'].includes(kind)) throw new HttpError(400, 'Unknown item');

  if (kind === 'a') {
    const found = await dynamodb.send(new GetCommand({ TableName: ACTIVITY_TABLE, Key: { actorId: ownerId, sk } }));
    if (!found.Item) throw new HttpError(404, 'Item not found');
    if (ownerId !== callerId && !(await areFriends(callerId, ownerId))) throw new HttpError(403, 'Not visible to you');
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

const routes = [
  ['GET', /^\/feed$/, getFeed],
  ['PUT', /^\/feed\/items\/[^/]+\/reactions$/, setReaction],
  ['POST', /^\/recommendations$/, recommend]
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
