// libraryAPI Lambda Function
// A reader's books, shelves, and community stats for a book.
//
// Every request is authenticated by the API Gateway Cognito authorizer; the
// caller (claims.sub) may only read and change their own library. Friends
// viewing public shelves comes later and will be added here.
//
// A book has one reading status in `shelf` (Want to Read / Currently Reading /
// Finished) and may also sit on any number of the reader's custom shelves,
// listed by id in `shelves`.
//
// Tables
//   LIBRARY_TABLE   userId (HASH), isbn (RANGE); GSI isbn-index (isbn)
//   SHELVES_TABLE   userId (HASH), shelfId (RANGE) - custom shelves, plus
//                   visibility overrides for the status shelves
//   SESSIONS_TABLE  read-only, GSI bookIsbn-index - for book stats

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require('crypto');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const LIBRARY_TABLE = process.env.LIBRARY_TABLE || 'pagebound-library';
const SHELVES_TABLE = process.env.SHELVES_TABLE || 'pagebound-shelves';
const SESSIONS_TABLE = process.env.SESSIONS_TABLE || 'pagebound-sessions';

// Reading-status shelves every reader has. `name` is what books store in `shelf`.
const STATUS_SHELVES = [
  { shelfId: 'currently-reading', name: 'Currently Reading' },
  { shelfId: 'want-to-read', name: 'Want to Read' },
  { shelfId: 'finished', name: 'Finished' }
];
const VISIBILITIES = ['public', 'private'];
const MAX_CUSTOM_SHELVES = 50;

// Shelves that count as "finished" for stats (the UI says Finished; older data said Read)
const FINISHED_SHELVES = ['Finished', 'Read'];

// Fields a reader may set on a book
const EDITABLE_FIELDS = {
  title: 'string',
  author: 'string',
  coverUrl: 'string',
  description: 'string',
  publishYear: 'string',
  shelf: 'string',
  currentChapter: 'number',
  totalChapters: 'number',
  currentPage: 'number',
  totalPages: 'number',
  progress: 'number',
  rating: 'number',
  shelves: 'list'
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

// Keep only known fields, coerced to their type
function pickEditable(input) {
  const out = {};
  Object.entries(EDITABLE_FIELDS).forEach(([field, type]) => {
    if (input[field] === undefined) return;
    if (input[field] === null) {
      out[field] = null;
    } else if (type === 'list') {
      out[field] = Array.isArray(input[field])
        ? [...new Set(input[field].filter(v => typeof v === 'string' && v).map(v => v.slice(0, 100)))].slice(0, MAX_CUSTOM_SHELVES)
        : [];
    } else if (type === 'number') {
      const n = Number(input[field]);
      out[field] = Number.isFinite(n) && n >= 0 ? n : 0;
    } else {
      out[field] = String(input[field]).slice(0, 5000);
    }
  });
  return out;
}

function requireOwner(event, callerId) {
  const userId = event.pathParameters?.userId;
  if (userId !== callerId) throw new HttpError(403, 'You can only access your own library');
  return userId;
}

// GET /library/{userId}/books[?shelf=]
async function listBooks(event, callerId) {
  const userId = requireOwner(event, callerId);
  const shelf = event.queryStringParameters?.shelf;

  const params = {
    TableName: LIBRARY_TABLE,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: { ':userId': userId }
  };
  if (shelf) {
    params.FilterExpression = 'shelf = :shelf';
    params.ExpressionAttributeValues[':shelf'] = shelf;
  }

  const result = await dynamodb.send(new QueryCommand(params));
  return json(200, { books: result.Items || [], count: result.Count || 0 });
}

// POST /library/{userId}/books
async function addBook(event, callerId) {
  const userId = requireOwner(event, callerId);
  const body = parseBody(event);
  if (!body.isbn || !body.title) throw new HttpError(400, 'isbn and title are required');

  const now = new Date().toISOString();
  const editable = pickEditable(body);
  if (editable.shelves) editable.shelves = await validCustomShelfIds(userId, editable.shelves);
  const item = {
    shelf: 'Want to Read',
    shelves: [],
    currentChapter: 0,
    totalChapters: 0,
    currentPage: 0,
    totalPages: 0,
    progress: 0,
    rating: 0,
    ...editable,
    userId,
    isbn: String(body.isbn),
    addedAt: body.addedAt || now,
    lastReadAt: now
  };

  // Don't overwrite a book that's already on a shelf
  try {
    await dynamodb.send(new PutCommand({
      TableName: LIBRARY_TABLE,
      Item: item,
      ConditionExpression: 'attribute_not_exists(isbn)'
    }));
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      throw new HttpError(409, 'This book is already in your library');
    }
    throw error;
  }

  return json(201, { book: item });
}

// PUT /library/{userId}/books/{isbn}
async function updateBook(event, callerId) {
  const userId = requireOwner(event, callerId);
  const isbn = decodeURIComponent(event.pathParameters.isbn);
  const updates = pickEditable(parseBody(event));
  if (updates.shelves) updates.shelves = await validCustomShelfIds(userId, updates.shelves);

  const existing = await dynamodb.send(new GetCommand({ TableName: LIBRARY_TABLE, Key: { userId, isbn } }));
  if (!existing.Item) throw new HttpError(404, 'Book not found in your library');

  const now = new Date().toISOString();
  if (updates.shelf && FINISHED_SHELVES.includes(updates.shelf) && !existing.Item.completedAt) {
    updates.completedAt = now;
  }
  updates.lastReadAt = now;

  const names = {};
  const values = {};
  const sets = Object.entries(updates).map(([field, value], i) => {
    names[`#f${i}`] = field;
    values[`:v${i}`] = value;
    return `#f${i} = :v${i}`;
  });

  const result = await dynamodb.send(new UpdateCommand({
    TableName: LIBRARY_TABLE,
    Key: { userId, isbn },
    UpdateExpression: 'SET ' + sets.join(', '),
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW'
  }));

  return json(200, { book: result.Attributes });
}

// DELETE /library/{userId}/books/{isbn}
async function removeBook(event, callerId) {
  const userId = requireOwner(event, callerId);
  const isbn = decodeURIComponent(event.pathParameters.isbn);
  await dynamodb.send(new DeleteCommand({ TableName: LIBRARY_TABLE, Key: { userId, isbn } }));
  return json(200, { ok: true });
}

// GET /library/{userId}/stats
async function getStats(event, callerId) {
  const userId = requireOwner(event, callerId);
  const result = await dynamodb.send(new QueryCommand({
    TableName: LIBRARY_TABLE,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: { ':userId': userId }
  }));
  const books = result.Items || [];
  const finished = books.filter(b => FINISHED_SHELVES.includes(b.shelf));

  return json(200, {
    totalBooks: books.length,
    currentlyReading: books.filter(b => b.shelf === 'Currently Reading').length,
    wantToRead: books.filter(b => b.shelf === 'Want to Read').length,
    booksRead: finished.length,
    chaptersCompleted: finished.reduce((sum, b) => sum + (b.totalChapters || 0), 0)
  });
}

// ---------------------------------------------------------------- shelves

async function getShelfItems(userId) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: SHELVES_TABLE,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: { ':userId': userId }
  }));
  return result.Items || [];
}

const withoutOwner = ({ userId, ...rest }) => rest;

// Status shelves (with any stored visibility) followed by custom shelves
async function shelvesFor(userId) {
  const stored = await getShelfItems(userId);
  const byId = Object.fromEntries(stored.map(s => [s.shelfId, s]));
  const status = STATUS_SHELVES.map(s => ({
    ...s,
    kind: 'status',
    visibility: byId[s.shelfId]?.visibility || 'public'
  }));
  const custom = stored
    .filter(s => s.kind === 'custom')
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
    .map(withoutOwner);
  return [...status, ...custom];
}

// Keep only ids of the reader's own custom shelves
async function validCustomShelfIds(userId, ids) {
  if (!ids.length) return [];
  const own = new Set((await getShelfItems(userId)).filter(s => s.kind === 'custom').map(s => s.shelfId));
  return ids.filter(id => own.has(id));
}

function cleanShelfName(name) {
  const clean = String(name || '').replace(/\s+/g, ' ').trim();
  if (!clean) throw new HttpError(400, 'Give the shelf a name');
  if (clean.length > 40) throw new HttpError(400, 'Shelf names can be up to 40 characters');
  return clean;
}

async function assertNameFree(userId, name, exceptShelfId) {
  const taken = (await shelvesFor(userId))
    .some(s => s.shelfId !== exceptShelfId && s.name.toLowerCase() === name.toLowerCase());
  if (taken) throw new HttpError(409, 'You already have a shelf with that name');
}

// GET /library/{userId}/shelves
async function listShelves(event, callerId) {
  const userId = requireOwner(event, callerId);
  return json(200, { shelves: await shelvesFor(userId) });
}

// POST /library/{userId}/shelves  { name, visibility }
async function createShelf(event, callerId) {
  const userId = requireOwner(event, callerId);
  const body = parseBody(event);
  const name = cleanShelfName(body.name);
  const visibility = VISIBILITIES.includes(body.visibility) ? body.visibility : 'public';

  const existing = (await getShelfItems(userId)).filter(s => s.kind === 'custom');
  if (existing.length >= MAX_CUSTOM_SHELVES) {
    throw new HttpError(400, `You can have up to ${MAX_CUSTOM_SHELVES} shelves`);
  }
  await assertNameFree(userId, name);

  const shelf = {
    userId,
    shelfId: `shelf-${randomUUID()}`,
    kind: 'custom',
    name,
    visibility,
    createdAt: new Date().toISOString()
  };
  await dynamodb.send(new PutCommand({ TableName: SHELVES_TABLE, Item: shelf }));
  return json(201, { shelf: withoutOwner(shelf) });
}

// PUT /library/{userId}/shelves/{shelfId}  { name?, visibility? }
// Status shelves can only change visibility.
async function updateShelf(event, callerId) {
  const userId = requireOwner(event, callerId);
  const shelfId = decodeURIComponent(event.pathParameters.shelfId);
  const body = parseBody(event);
  const status = STATUS_SHELVES.find(s => s.shelfId === shelfId);

  if (body.visibility !== undefined && !VISIBILITIES.includes(body.visibility)) {
    throw new HttpError(400, 'Visibility must be public or private');
  }

  if (status) {
    if (body.name !== undefined && body.name !== status.name) {
      throw new HttpError(400, 'Reading-status shelves cannot be renamed');
    }
    const visibility = body.visibility || 'public';
    await dynamodb.send(new PutCommand({
      TableName: SHELVES_TABLE,
      Item: { userId, shelfId, kind: 'status', visibility }
    }));
    return json(200, { shelf: { ...status, kind: 'status', visibility } });
  }

  const found = await dynamodb.send(new GetCommand({ TableName: SHELVES_TABLE, Key: { userId, shelfId } }));
  if (!found.Item || found.Item.kind !== 'custom') throw new HttpError(404, 'Shelf not found');

  const shelf = { ...found.Item };
  if (body.name !== undefined) {
    shelf.name = cleanShelfName(body.name);
    await assertNameFree(userId, shelf.name, shelfId);
  }
  if (body.visibility !== undefined) shelf.visibility = body.visibility;
  shelf.updatedAt = new Date().toISOString();

  await dynamodb.send(new PutCommand({ TableName: SHELVES_TABLE, Item: shelf }));
  return json(200, { shelf: withoutOwner(shelf) });
}

// DELETE /library/{userId}/shelves/{shelfId} - custom shelves only; the books
// stay in the library and just leave the shelf
async function deleteShelf(event, callerId) {
  const userId = requireOwner(event, callerId);
  const shelfId = decodeURIComponent(event.pathParameters.shelfId);
  if (STATUS_SHELVES.some(s => s.shelfId === shelfId)) {
    throw new HttpError(400, 'Reading-status shelves cannot be deleted');
  }

  const found = await dynamodb.send(new GetCommand({ TableName: SHELVES_TABLE, Key: { userId, shelfId } }));
  if (!found.Item) throw new HttpError(404, 'Shelf not found');

  const books = await dynamodb.send(new QueryCommand({
    TableName: LIBRARY_TABLE,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: { ':userId': userId }
  }));
  for (const book of (books.Items || []).filter(b => (b.shelves || []).includes(shelfId))) {
    await dynamodb.send(new UpdateCommand({
      TableName: LIBRARY_TABLE,
      Key: { userId, isbn: book.isbn },
      UpdateExpression: 'SET shelves = :shelves',
      ExpressionAttributeValues: { ':shelves': book.shelves.filter(id => id !== shelfId) }
    }));
  }

  await dynamodb.send(new DeleteCommand({ TableName: SHELVES_TABLE, Key: { userId, shelfId } }));
  return json(200, { ok: true });
}

// ---------------------------------------------------------------- book stats

// GET /books/{isbn}/stats - community totals only, never who
async function bookStats(event, callerId) {
  const isbn = decodeURIComponent(event.pathParameters?.isbn || '');
  if (!isbn) throw new HttpError(400, 'isbn is required');

  const owners = await dynamodb.send(new QueryCommand({
    TableName: LIBRARY_TABLE,
    IndexName: 'isbn-index',
    KeyConditionExpression: 'isbn = :isbn',
    ExpressionAttributeValues: { ':isbn': isbn }
  }));
  const items = owners.Items || [];
  const ratings = items.map(b => Number(b.rating) || 0).filter(r => r > 0);

  const sessions = await dynamodb.send(new QueryCommand({
    TableName: SESSIONS_TABLE,
    IndexName: 'bookIsbn-index',
    KeyConditionExpression: 'bookIsbn = :isbn',
    ExpressionAttributeValues: { ':isbn': isbn }
  }));

  return json(200, {
    isbn,
    inLibraries: items.length,
    inMyLibrary: items.some(b => b.userId === callerId),
    activeSessions: (sessions.Items || []).length,
    ratingCount: ratings.length,
    ratingAverage: ratings.length
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null
  });
}

const routes = [
  ['GET', /^\/library\/[^/]+\/books$/, listBooks],
  ['POST', /^\/library\/[^/]+\/books$/, addBook],
  ['PUT', /^\/library\/[^/]+\/books\/[^/]+$/, updateBook],
  ['DELETE', /^\/library\/[^/]+\/books\/[^/]+$/, removeBook],
  ['GET', /^\/library\/[^/]+\/stats$/, getStats],
  ['GET', /^\/library\/[^/]+\/shelves$/, listShelves],
  ['POST', /^\/library\/[^/]+\/shelves$/, createShelf],
  ['PUT', /^\/library\/[^/]+\/shelves\/[^/]+$/, updateShelf],
  ['DELETE', /^\/library\/[^/]+\/shelves\/[^/]+$/, deleteShelf],
  ['GET', /^\/books\/[^/]+\/stats$/, bookStats]
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
