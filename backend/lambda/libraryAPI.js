// libraryAPI Lambda Function
// A reader's books and shelves.
//
// Every request is authenticated by the API Gateway Cognito authorizer; the
// caller (claims.sub) may only read and change their own library. Friends
// viewing public shelves comes later and will be added here.
//
// Table: LIBRARY_TABLE  userId (HASH), isbn (RANGE), GSI userId-shelf-index

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const LIBRARY_TABLE = process.env.LIBRARY_TABLE || 'pagebound-library';

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
  rating: 'number'
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
  const item = {
    shelf: 'Want to Read',
    currentChapter: 0,
    totalChapters: 0,
    currentPage: 0,
    totalPages: 0,
    progress: 0,
    rating: 0,
    ...pickEditable(body),
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

const routes = [
  ['GET', /^\/library\/[^/]+\/books$/, listBooks],
  ['POST', /^\/library\/[^/]+\/books$/, addBook],
  ['PUT', /^\/library\/[^/]+\/books\/[^/]+$/, updateBook],
  ['DELETE', /^\/library\/[^/]+\/books\/[^/]+$/, removeBook],
  ['GET', /^\/library\/[^/]+\/stats$/, getStats]
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
