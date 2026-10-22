const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const LIBRARY_TABLE = process.env.LIBRARY_TABLE || 'pagebound-library';

exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  const httpMethod = event.httpMethod;
  const path = event.path;
  const pathParameters = event.pathParameters || {};
  const queryStringParameters = event.queryStringParameters || {};

  let response;

  try {
    // GET /library/{userId}/books - Get all books for user
    if (httpMethod === 'GET' && path.match(/\/library\/[^/]+\/books$/)) {
      const userId = pathParameters.userId;
      const shelf = queryStringParameters.shelf;

      let queryParams = {
        TableName: LIBRARY_TABLE,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        }
      };

      // Filter by shelf if provided
      if (shelf) {
        queryParams.FilterExpression = 'shelf = :shelf';
        queryParams.ExpressionAttributeValues[':shelf'] = shelf;
      }

      const result = await dynamodb.send(new QueryCommand(queryParams));

      response = {
        statusCode: 200,
        body: JSON.stringify({
          books: result.Items || [],
          count: result.Count || 0
        })
      };
    }

    // POST /library/{userId}/books - Add book to library
    else if (httpMethod === 'POST' && path.match(/\/library\/[^/]+\/books$/)) {
      const userId = pathParameters.userId;
      const book = JSON.parse(event.body);

      await dynamodb.send(new PutCommand({
        TableName: LIBRARY_TABLE,
        Item: {
          userId,
          isbn: book.isbn,
          title: book.title,
          author: book.author,
          coverUrl: book.coverUrl || null,
          shelf: book.shelf || 'Want to Read',
          currentChapter: book.currentChapter || 0,
          totalChapters: book.totalChapters || 0,
          progress: book.progress || 0,
          rating: book.rating || 0,
          addedAt: book.addedAt || new Date().toISOString(),
          completedAt: book.completedAt || null,
          lastReadAt: new Date().toISOString()
        }
      }));

      response = {
        statusCode: 200,
        body: JSON.stringify({ success: true })
      };
    }

    // PUT /library/{userId}/books/{isbn} - Update book
    else if (httpMethod === 'PUT' && path.match(/\/library\/[^/]+\/books\/[^/]+$/)) {
      const userId = pathParameters.userId;
      const isbn = decodeURIComponent(pathParameters.isbn);
      const updates = JSON.parse(event.body);

      // Build update expression dynamically
      const updateParts = [];
      const values = {};

      if (updates.shelf !== undefined) {
        updateParts.push('shelf = :shelf');
        values[':shelf'] = updates.shelf;

        // Set completedAt if moving to 'Read' shelf
        if (updates.shelf === 'Read' && !updates.completedAt) {
          updateParts.push('completedAt = :completed');
          values[':completed'] = new Date().toISOString();
        }
      }
      if (updates.currentChapter !== undefined) {
        updateParts.push('currentChapter = :chapter');
        values[':chapter'] = updates.currentChapter;
      }
      if (updates.totalChapters !== undefined) {
        updateParts.push('totalChapters = :totalChapters');
        values[':totalChapters'] = updates.totalChapters;
      }
      if (updates.progress !== undefined) {
        updateParts.push('progress = :progress');
        values[':progress'] = updates.progress;
      }
      if (updates.rating !== undefined) {
        updateParts.push('rating = :rating');
        values[':rating'] = updates.rating;
      }

      updateParts.push('lastReadAt = :lastRead');
      values[':lastRead'] = new Date().toISOString();

      await dynamodb.send(new UpdateCommand({
        TableName: LIBRARY_TABLE,
        Key: { userId, isbn },
        UpdateExpression: 'SET ' + updateParts.join(', '),
        ExpressionAttributeValues: values
      }));

      response = {
        statusCode: 200,
        body: JSON.stringify({ success: true })
      };
    }

    // DELETE /library/{userId}/books/{isbn} - Remove book
    else if (httpMethod === 'DELETE' && path.match(/\/library\/[^/]+\/books\/[^/]+$/)) {
      const userId = pathParameters.userId;
      const isbn = decodeURIComponent(pathParameters.isbn);

      await dynamodb.send(new DeleteCommand({
        TableName: LIBRARY_TABLE,
        Key: { userId, isbn }
      }));

      response = {
        statusCode: 200,
        body: JSON.stringify({ success: true })
      };
    }

    // GET /library/{userId}/stats - Get library stats
    else if (httpMethod === 'GET' && path.match(/\/library\/[^/]+\/stats$/)) {
      const userId = pathParameters.userId;

      const result = await dynamodb.send(new QueryCommand({
        TableName: LIBRARY_TABLE,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        }
      }));

      const books = result.Items || [];

      const stats = {
        totalBooks: books.length,
        currentlyReading: books.filter(b => b.shelf === 'Currently Reading').length,
        wantToRead: books.filter(b => b.shelf === 'Want to Read').length,
        booksRead: books.filter(b => b.shelf === 'Read').length,
        chaptersCompleted: books
          .filter(b => b.shelf === 'Read')
          .reduce((sum, book) => sum + (book.totalChapters || 0), 0)
      };

      response = {
        statusCode: 200,
        body: JSON.stringify(stats)
      };
    }

    else {
      response = {
        statusCode: 404,
        body: JSON.stringify({ error: 'Endpoint not found' })
      };
    }

  } catch (error) {
    console.error('Error:', error);
    response = {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }

  // Add CORS headers
  response.headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  };

  return response;
};
