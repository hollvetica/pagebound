// sessionsAPI Lambda Function
// Shared reading sessions and spoiler-gated discussions.
//
// Every request is authenticated by the API Gateway Cognito authorizer; the
// caller is always taken from the token (claims.sub), never from the request
// body or query string.
//
// Tables
//   SESSIONS_TABLE  sessionId (HASH)                 – one item per session
//   MEMBERS_TABLE   userId (HASH), sessionId (RANGE) – who is in which session
//   MESSAGES_TABLE  messageId (HASH), GSI sessionId-index (sessionId, createdAt)
//   FRIENDS_TABLE   userId (HASH), friendUserId (RANGE)
//
// Progress is tracked per participant as currentChapter / currentPage. A
// session tracks one of them (trackingMode); comments are tagged with a
// position in that unit and stay hidden from a reader until their own
// progress reaches that position.

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, QueryCommand,
  UpdateCommand, BatchWriteCommand
} = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require('crypto');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const SESSIONS_TABLE = process.env.SESSIONS_TABLE;
const MEMBERS_TABLE = process.env.MEMBERS_TABLE;
const MESSAGES_TABLE = process.env.MESSAGES_TABLE;
const USERS_TABLE = process.env.USERS_TABLE;
const FRIENDS_TABLE = process.env.FRIENDS_TABLE;

class HttpError extends Error {
  constructor(statusCode, message, extra = {}) {
    super(message);
    this.statusCode = statusCode;
    this.extra = extra;
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

const toNumber = (value) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

async function getUserByUserId(userId) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: USERS_TABLE,
    IndexName: 'userId-index',
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: { ':userId': userId }
  }));
  return result.Items?.[0] || null;
}

async function areFriends(userId, friendUserId) {
  const result = await dynamodb.send(new GetCommand({
    TableName: FRIENDS_TABLE,
    Key: { userId, friendUserId }
  }));
  return !!result.Item;
}

async function getSessionItem(sessionId) {
  const result = await dynamodb.send(new GetCommand({
    TableName: SESSIONS_TABLE,
    Key: { sessionId }
  }));
  return result.Item || null;
}

// Load a session and make sure the caller is in it
async function getSessionForMember(sessionId, callerId) {
  const session = await getSessionItem(sessionId);
  if (!session) throw new HttpError(404, 'Session not found');
  if (!session.participants.some(p => p.userId === callerId)) {
    throw new HttpError(403, 'You are not in this session');
  }
  return session;
}

// A participant's position in the session's tracking unit
function positionOf(session, participant) {
  if (!participant) return 0;
  return session.trackingMode === 'pages'
    ? toNumber(participant.currentPage)
    : toNumber(participant.currentChapter);
}

async function withParticipantDetails(session) {
  const participants = await Promise.all(
    session.participants.map(async (p) => {
      const user = await getUserByUserId(p.userId);
      return {
        ...p,
        username: user?.username || 'Unknown',
        displayName: user?.displayName || user?.username || 'Unknown',
        avatarUrl: user?.avatarUrl || null
      };
    })
  );
  return { ...session, participants };
}

// The user's existing session for a book, if any (one session per book)
async function findSessionForBook(userId, bookIsbn) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: MEMBERS_TABLE,
    KeyConditionExpression: 'userId = :userId',
    FilterExpression: 'bookIsbn = :isbn',
    ExpressionAttributeValues: { ':userId': userId, ':isbn': bookIsbn }
  }));
  return result.Items?.[0] || null;
}

async function getSessionMessages(sessionId) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: MESSAGES_TABLE,
    IndexName: 'sessionId-index',
    KeyConditionExpression: 'sessionId = :sessionId',
    ExpressionAttributeValues: { ':sessionId': sessionId }
  }));
  return result.Items || [];
}

// Messages carry `position`; older items only had `chapterNumber`
const messagePosition = (m) => toNumber(m.position ?? m.chapterNumber);

// ----------------------------------------------------------------------------
// Handlers
// ----------------------------------------------------------------------------

// POST /sessions
async function createSession(event, callerId) {
  const body = parseBody(event);
  const {
    sessionName, bookTitle, bookAuthor, bookCover, bookIsbn,
    totalChapters, totalPages, trackingMode = 'chapters',
    participantUserIds = []
  } = body;

  if (!bookIsbn || !bookTitle) throw new HttpError(400, 'bookIsbn and bookTitle are required');
  if (!['chapters', 'pages'].includes(trackingMode)) throw new HttpError(400, 'trackingMode must be chapters or pages');
  const total = trackingMode === 'pages' ? toNumber(totalPages) : toNumber(totalChapters);
  if (!total) throw new HttpError(400, `Set the total ${trackingMode} to start a session`);

  const invitees = [...new Set(participantUserIds)].filter(id => id && id !== callerId);

  // Only friends can be invited
  for (const inviteeId of invitees) {
    if (!(await areFriends(callerId, inviteeId))) {
      throw new HttpError(403, 'You can only invite friends to a session');
    }
  }

  // One session per book, per reader
  const conflicts = [];
  for (const userId of [callerId, ...invitees]) {
    const existing = await findSessionForBook(userId, bookIsbn);
    if (existing) conflicts.push({ userId, sessionId: existing.sessionId });
  }
  if (conflicts.length) {
    const own = conflicts.find(c => c.userId === callerId);
    throw new HttpError(409, own
      ? 'You already have a session for this book'
      : 'A friend you invited already has a session for this book', { conflicts });
  }

  const sessionId = randomUUID();
  const createdAt = new Date().toISOString();
  const participant = (userId, isHost) => ({
    userId, isHost, currentChapter: 0, currentPage: 0, joinedAt: createdAt
  });

  const session = {
    sessionId,
    sessionName: sessionName || bookTitle,
    bookTitle,
    bookAuthor: bookAuthor || '',
    bookCover: bookCover || null,
    bookIsbn,
    totalChapters: toNumber(totalChapters) || null,
    totalPages: toNumber(totalPages) || null,
    trackingMode,
    hostUserId: callerId,
    participants: [participant(callerId, true), ...invitees.map(id => participant(id, false))],
    createdAt,
    updatedAt: createdAt
  };

  await dynamodb.send(new PutCommand({ TableName: SESSIONS_TABLE, Item: session }));
  await dynamodb.send(new BatchWriteCommand({
    RequestItems: {
      [MEMBERS_TABLE]: session.participants.map(p => ({
        PutRequest: { Item: { userId: p.userId, sessionId, bookIsbn, joinedAt: createdAt } }
      }))
    }
  }));

  return json(201, { session: await withParticipantDetails(session) });
}

// GET /sessions/users/{userId}/list
async function listSessions(event, callerId) {
  if (event.pathParameters.userId !== callerId) throw new HttpError(403, 'You can only list your own sessions');

  const members = await dynamodb.send(new QueryCommand({
    TableName: MEMBERS_TABLE,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: { ':userId': callerId }
  }));

  const sessions = (await Promise.all(
    (members.Items || []).map(async (m) => {
      const session = await getSessionItem(m.sessionId);
      if (!session) return null;
      const details = await withParticipantDetails(session);

      // Comments waiting for this reader: not theirs and not yet read
      const me = session.participants.find(p => p.userId === callerId);
      const myPosition = positionOf(session, me);
      const messages = await getSessionMessages(session.sessionId);
      const unread = messages.filter(msg => msg.userId !== callerId && !msg.readBy?.[callerId]);
      return {
        ...details,
        unreadCount: unread.length,
        unreadVisibleCount: unread.filter(msg => messagePosition(msg) <= myPosition).length
      };
    })
  )).filter(Boolean);

  sessions.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  return json(200, { sessions });
}

// GET /sessions/{sessionId}
async function getSession(event, callerId) {
  const session = await getSessionForMember(event.pathParameters.sessionId, callerId);
  return json(200, { session: await withParticipantDetails(session) });
}

// PUT /sessions/{sessionId}/progress  – the caller's own progress
async function updateProgress(event, callerId) {
  const sessionId = event.pathParameters.sessionId;
  const session = await getSessionForMember(sessionId, callerId);
  const body = parseBody(event);

  const clamp = (value, max) => {
    const n = toNumber(value);
    return max ? Math.min(n, max) : n;
  };

  const participants = session.participants.map(p =>
    p.userId === callerId
      ? {
          ...p,
          currentChapter: body.currentChapter !== undefined ? clamp(body.currentChapter, session.totalChapters) : p.currentChapter,
          currentPage: body.currentPage !== undefined ? clamp(body.currentPage, session.totalPages) : p.currentPage,
          progressUpdatedAt: new Date().toISOString()
        }
      : p
  );

  const updatedAt = new Date().toISOString();
  await dynamodb.send(new UpdateCommand({
    TableName: SESSIONS_TABLE,
    Key: { sessionId },
    UpdateExpression: 'SET participants = :participants, updatedAt = :updatedAt',
    ExpressionAttributeValues: { ':participants': participants, ':updatedAt': updatedAt }
  }));

  return json(200, { session: await withParticipantDetails({ ...session, participants, updatedAt }) });
}

// POST /sessions/{sessionId}/messages
async function postMessage(event, callerId) {
  const sessionId = event.pathParameters.sessionId;
  const session = await getSessionForMember(sessionId, callerId);
  const body = parseBody(event);

  const text = (body.message || '').trim();
  if (!text) throw new HttpError(400, 'Message is empty');
  if (text.length > 2000) throw new HttpError(400, 'Message is too long');

  const me = session.participants.find(p => p.userId === callerId);
  const position = body.position !== undefined || body.chapterNumber !== undefined
    ? toNumber(body.position ?? body.chapterNumber)
    : positionOf(session, me);
  const total = session.trackingMode === 'pages' ? session.totalPages : session.totalChapters;
  if (total && position > total) throw new HttpError(400, `Position must be between 0 and ${total}`);

  const user = await getUserByUserId(callerId);
  const createdAt = new Date().toISOString();
  const messageItem = {
    messageId: randomUUID(),
    sessionId,
    userId: callerId,
    username: user?.username || 'Unknown',
    displayName: user?.displayName || user?.username || 'Unknown',
    avatarUrl: user?.avatarUrl || null,
    message: text,
    position,
    chapterNumber: position, // kept for older clients
    unit: session.trackingMode,
    createdAt,
    readBy: { [callerId]: createdAt }
  };

  await dynamodb.send(new PutCommand({ TableName: MESSAGES_TABLE, Item: messageItem }));
  await dynamodb.send(new UpdateCommand({
    TableName: SESSIONS_TABLE,
    Key: { sessionId },
    UpdateExpression: 'SET updatedAt = :updatedAt, lastMessageAt = :updatedAt',
    ExpressionAttributeValues: { ':updatedAt': createdAt }
  }));

  return json(201, { message: messageItem });
}

// GET /sessions/{sessionId}/messages
// Visible: the caller's own messages and anything at or before their position.
// Hidden messages only reveal where they are, never what they say or who wrote them.
async function getMessages(event, callerId) {
  const sessionId = event.pathParameters.sessionId;
  const session = await getSessionForMember(sessionId, callerId);
  const me = session.participants.find(p => p.userId === callerId);
  const myPosition = positionOf(session, me);

  const messages = (await getSessionMessages(sessionId))
    .map(m => ({ ...m, position: messagePosition(m) }));

  const isVisible = (m) => m.userId === callerId || m.position <= myPosition;
  const visibleMessages = messages.filter(isVisible);
  const hiddenMessages = messages
    .filter(m => !isVisible(m))
    .map(m => ({
      messageId: m.messageId,
      position: m.position,
      chapterNumber: m.position,
      createdAt: m.createdAt
    }));

  return json(200, {
    trackingMode: session.trackingMode,
    userPosition: myPosition,
    userCurrentChapter: myPosition, // kept for older clients
    visibleMessages,
    hiddenMessages
  });
}

// PUT /sessions/{sessionId}/messages/{messageId}/read
async function markRead(event, callerId) {
  const { sessionId, messageId } = event.pathParameters;
  const session = await getSessionForMember(sessionId, callerId);

  const result = await dynamodb.send(new GetCommand({ TableName: MESSAGES_TABLE, Key: { messageId } }));
  const message = result.Item;
  if (!message || message.sessionId !== sessionId) throw new HttpError(404, 'Message not found');

  const me = session.participants.find(p => p.userId === callerId);
  if (message.userId !== callerId && messagePosition(message) > positionOf(session, me)) {
    throw new HttpError(403, 'You have not reached this message yet');
  }

  await dynamodb.send(new UpdateCommand({
    TableName: MESSAGES_TABLE,
    Key: { messageId },
    UpdateExpression: 'SET readBy.#userId = :readAt',
    ExpressionAttributeNames: { '#userId': callerId },
    ExpressionAttributeValues: { ':readAt': new Date().toISOString() }
  }));

  return json(200, { ok: true });
}

// GET /sessions/{sessionId}/unread-timeline – unread comments grouped by position
async function unreadTimeline(event, callerId) {
  const sessionId = event.pathParameters.sessionId;
  await getSessionForMember(sessionId, callerId);

  const unreadByPosition = (await getSessionMessages(sessionId))
    .filter(m => m.userId !== callerId && !m.readBy?.[callerId])
    .reduce((acc, m) => {
      const position = messagePosition(m);
      acc[position] = (acc[position] || 0) + 1;
      return acc;
    }, {});

  return json(200, { unreadByPosition, unreadByChapter: unreadByPosition });
}

// DELETE /sessions/{sessionId} – host only; removes members and messages too
async function deleteSession(event, callerId) {
  const sessionId = event.pathParameters.sessionId;
  const session = await getSessionForMember(sessionId, callerId);
  if (session.hostUserId !== callerId && !session.participants.find(p => p.userId === callerId)?.isHost) {
    throw new HttpError(403, 'Only the host can delete a session');
  }

  const messages = await getSessionMessages(sessionId);
  const deletes = [
    ...session.participants.map(p => ({ table: MEMBERS_TABLE, key: { userId: p.userId, sessionId } })),
    ...messages.map(m => ({ table: MESSAGES_TABLE, key: { messageId: m.messageId } }))
  ];
  for (let i = 0; i < deletes.length; i += 25) {
    const batch = deletes.slice(i, i + 25);
    const requestItems = {};
    batch.forEach(({ table, key }) => {
      (requestItems[table] = requestItems[table] || []).push({ DeleteRequest: { Key: key } });
    });
    await dynamodb.send(new BatchWriteCommand({ RequestItems: requestItems }));
  }
  await dynamodb.send(new DeleteCommand({ TableName: SESSIONS_TABLE, Key: { sessionId } }));

  return json(200, { ok: true });
}

// ----------------------------------------------------------------------------
// Router
// ----------------------------------------------------------------------------
const routes = [
  ['POST', /^\/sessions$/, createSession],
  ['GET', /^\/sessions\/users\/[^/]+\/list$/, listSessions],
  ['GET', /^\/sessions\/[^/]+\/messages$/, getMessages],
  ['POST', /^\/sessions\/[^/]+\/messages$/, postMessage],
  ['PUT', /^\/sessions\/[^/]+\/messages\/[^/]+\/read$/, markRead],
  ['GET', /^\/sessions\/[^/]+\/unread-timeline$/, unreadTimeline],
  ['PUT', /^\/sessions\/[^/]+\/progress$/, updateProgress],
  ['GET', /^\/sessions\/[^/]+$/, getSession],
  ['DELETE', /^\/sessions\/[^/]+$/, deleteSession]
];

exports.handler = async (event) => {
  console.log('Request:', event.httpMethod, event.path);

  let response;
  try {
    const route = routes.find(([method, pattern]) => method === event.httpMethod && pattern.test(event.path));
    if (!route) throw new HttpError(404, 'Endpoint not found');
    event.pathParameters = event.pathParameters || {};
    response = await route[2](event, getCallerId(event));
  } catch (error) {
    if (error instanceof HttpError) {
      response = json(error.statusCode, { error: error.message, ...error.extra });
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
