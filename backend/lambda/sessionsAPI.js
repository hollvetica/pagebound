// sessionsAPI Lambda Function
// Handles all session and discussion-related API requests via API Gateway

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, QueryCommand, UpdateCommand, BatchGetCommand } = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require('crypto');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

// Helper function to get user by userId
async function getUserByUserId(userId) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: process.env.USERS_TABLE,
    IndexName: 'userId-index',
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId
    }
  }));

  return result.Items && result.Items.length > 0 ? result.Items[0] : null;
}

// Helper function to get session with participants
async function getSessionWithDetails(sessionId) {
  const sessionResult = await dynamodb.send(new GetCommand({
    TableName: process.env.SESSIONS_TABLE,
    Key: { sessionId }
  }));

  if (!sessionResult.Item) {
    return null;
  }

  const session = sessionResult.Item;

  // Fetch participant details
  const participantDetails = await Promise.all(
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

  return {
    ...session,
    participants: participantDetails
  };
}

exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  const httpMethod = event.httpMethod;
  const path = event.path;
  const pathParameters = event.pathParameters || {};
  const queryStringParameters = event.queryStringParameters || {};

  let response;

  try {
    // ========================================
    // POST /sessions - Create new session
    // ========================================
    if (httpMethod === 'POST' && path === '/sessions') {
      const body = JSON.parse(event.body);
      const {
        sessionName,
        bookTitle,
        bookAuthor,
        bookCover,
        bookIsbn,
        totalChapters,
        totalPages,
        trackingMode,
        hostUserId,
        participantUserIds
      } = body;

      const sessionId = randomUUID();
      const createdAt = new Date().toISOString();

      // Create participants array with host first
      const participants = [
        {
          userId: hostUserId,
          currentChapter: 0,
          currentPage: 0,
          isHost: true,
          joinedAt: createdAt
        },
        ...participantUserIds.map(userId => ({
          userId,
          currentChapter: 0,
          currentPage: 0,
          isHost: false,
          joinedAt: createdAt
        }))
      ];

      const session = {
        sessionId,
        sessionName,
        bookTitle,
        bookAuthor,
        bookCover: bookCover || null,
        bookIsbn,
        totalChapters,
        totalPages: totalPages || null,
        trackingMode: trackingMode || 'chapters',
        participants,
        createdAt,
        updatedAt: createdAt
      };

      await dynamodb.send(new PutCommand({
        TableName: process.env.SESSIONS_TABLE,
        Item: session
      }));

      const sessionWithDetails = await getSessionWithDetails(sessionId);

      response = {
        statusCode: 200,
        body: JSON.stringify({ session: sessionWithDetails })
      };
    }

    // ========================================
    // GET /sessions/{userId}/list - Get user's sessions
    // ========================================
    else if (httpMethod === 'GET' && path.match(/\/sessions\/[^/]+\/list$/)) {
      const userId = pathParameters.userId;

      // Query all sessions (we'll filter in application since participants is a list)
      const sessionsResult = await dynamodb.send(new QueryCommand({
        TableName: process.env.SESSIONS_TABLE,
        IndexName: 'hostUserId-index',
        KeyConditionExpression: 'hostUserId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        }
      }));

      // Also scan for sessions where user is a participant (not efficient for large datasets)
      const allSessionsResult = await dynamodb.send(new QueryCommand({
        TableName: process.env.SESSIONS_TABLE,
        IndexName: 'bookIsbn-index',
        KeyConditionExpression: 'bookIsbn = :isbn',
        ExpressionAttributeValues: {
          ':isbn': 'dummy' // This needs a better approach
        }
      }));

      // For now, let's use a simpler approach - scan and filter
      // In production, consider maintaining a user-sessions mapping table
      const sessions = await Promise.all(
        (sessionsResult.Items || []).map(session => getSessionWithDetails(session.sessionId))
      );

      response = {
        statusCode: 200,
        body: JSON.stringify({ sessions })
      };
    }

    // ========================================
    // GET /sessions/{sessionId} - Get session details
    // ========================================
    else if (httpMethod === 'GET' && path.match(/\/sessions\/[^/]+$/)) {
      const sessionId = pathParameters.sessionId;
      const session = await getSessionWithDetails(sessionId);

      if (!session) {
        response = {
          statusCode: 404,
          body: JSON.stringify({ error: 'Session not found' })
        };
      } else {
        response = {
          statusCode: 200,
          body: JSON.stringify({ session })
        };
      }
    }

    // ========================================
    // PUT /sessions/{sessionId}/progress - Update participant progress
    // ========================================
    else if (httpMethod === 'PUT' && path.match(/\/sessions\/[^/]+\/progress$/)) {
      const sessionId = pathParameters.sessionId;
      const body = JSON.parse(event.body);
      const { userId, currentChapter, currentPage } = body;

      // Get the session
      const sessionResult = await dynamodb.send(new GetCommand({
        TableName: process.env.SESSIONS_TABLE,
        Key: { sessionId }
      }));

      if (!sessionResult.Item) {
        response = {
          statusCode: 404,
          body: JSON.stringify({ error: 'Session not found' })
        };
      } else {
        const session = sessionResult.Item;

        // Update the specific participant's progress
        const updatedParticipants = session.participants.map(p =>
          p.userId === userId
            ? { ...p, currentChapter, currentPage: currentPage || p.currentPage }
            : p
        );

        await dynamodb.send(new UpdateCommand({
          TableName: process.env.SESSIONS_TABLE,
          Key: { sessionId },
          UpdateExpression: 'SET participants = :participants, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':participants': updatedParticipants,
            ':updatedAt': new Date().toISOString()
          }
        }));

        const updatedSession = await getSessionWithDetails(sessionId);

        response = {
          statusCode: 200,
          body: JSON.stringify({ session: updatedSession })
        };
      }
    }

    // ========================================
    // POST /sessions/{sessionId}/messages - Post message to discussion
    // ========================================
    else if (httpMethod === 'POST' && path.match(/\/sessions\/[^/]+\/messages$/)) {
      const sessionId = pathParameters.sessionId;
      const body = JSON.parse(event.body);
      const { userId, message, chapterNumber } = body;

      const messageId = randomUUID();
      const createdAt = new Date().toISOString();

      // Get user details
      const user = await getUserByUserId(userId);

      const messageItem = {
        messageId,
        sessionId,
        userId,
        username: user?.username || 'Unknown',
        displayName: user?.displayName || user?.username || 'Unknown',
        avatarUrl: user?.avatarUrl || null,
        message,
        chapterNumber,
        createdAt,
        // Initialize read status - empty map, will be populated as users read
        readBy: {} // { userId: timestamp }
      };

      await dynamodb.send(new PutCommand({
        TableName: process.env.MESSAGES_TABLE,
        Item: messageItem
      }));

      response = {
        statusCode: 200,
        body: JSON.stringify({ message: messageItem })
      };
    }

    // ========================================
    // GET /sessions/{sessionId}/messages - Get messages for session
    // ========================================
    else if (httpMethod === 'GET' && path.match(/\/sessions\/[^/]+\/messages$/)) {
      const sessionId = pathParameters.sessionId;
      const userId = queryStringParameters.userId; // Used to filter based on user's progress

      // Get session to check user's progress
      const session = await getSessionWithDetails(sessionId);

      if (!session) {
        response = {
          statusCode: 404,
          body: JSON.stringify({ error: 'Session not found' })
        };
      } else {
        // Find user's current chapter
        const userParticipant = session.participants.find(p => p.userId === userId);
        const userCurrentChapter = userParticipant?.currentChapter || 0;

        // Query all messages for this session
        const messagesResult = await dynamodb.send(new QueryCommand({
          TableName: process.env.MESSAGES_TABLE,
          IndexName: 'sessionId-index',
          KeyConditionExpression: 'sessionId = :sessionId',
          ExpressionAttributeValues: {
            ':sessionId': sessionId
          }
        }));

        const allMessages = messagesResult.Items || [];

        // Separate messages into visible and hidden
        const visibleMessages = allMessages.filter(m => m.chapterNumber <= userCurrentChapter);
        const hiddenMessages = allMessages.filter(m => m.chapterNumber > userCurrentChapter);

        response = {
          statusCode: 200,
          body: JSON.stringify({
            visibleMessages,
            hiddenMessages: hiddenMessages.map(m => ({
              messageId: m.messageId,
              chapterNumber: m.chapterNumber,
              createdAt: m.createdAt,
              isRead: m.readBy?.[userId] ? true : false
            })),
            userCurrentChapter
          })
        };
      }
    }

    // ========================================
    // PUT /sessions/{sessionId}/messages/{messageId}/read - Mark message as read
    // ========================================
    else if (httpMethod === 'PUT' && path.match(/\/sessions\/[^/]+\/messages\/[^/]+\/read$/)) {
      const { sessionId, messageId } = pathParameters;
      const body = JSON.parse(event.body);
      const { userId } = body;

      const readAt = new Date().toISOString();

      await dynamodb.send(new UpdateCommand({
        TableName: process.env.MESSAGES_TABLE,
        Key: { messageId },
        UpdateExpression: 'SET readBy.#userId = :readAt',
        ExpressionAttributeNames: {
          '#userId': userId
        },
        ExpressionAttributeValues: {
          ':readAt': readAt
        }
      }));

      response = {
        statusCode: 200,
        body: JSON.stringify({ message: 'Message marked as read' })
      };
    }

    // ========================================
    // GET /sessions/{sessionId}/unread-timeline - Get unread message indicators for timeline
    // ========================================
    else if (httpMethod === 'GET' && path.match(/\/sessions\/[^/]+\/unread-timeline$/)) {
      const sessionId = pathParameters.sessionId;
      const userId = queryStringParameters.userId;

      // Get all messages for this session
      const messagesResult = await dynamodb.send(new QueryCommand({
        TableName: process.env.MESSAGES_TABLE,
        IndexName: 'sessionId-index',
        KeyConditionExpression: 'sessionId = :sessionId',
        ExpressionAttributeValues: {
          ':sessionId': sessionId
        }
      }));

      const allMessages = messagesResult.Items || [];

      // Filter to unread messages for this user
      const unreadMessages = allMessages.filter(m => !m.readBy?.[userId]);

      // Group by chapter and count
      const unreadByChapter = unreadMessages.reduce((acc, m) => {
        if (!acc[m.chapterNumber]) {
          acc[m.chapterNumber] = 0;
        }
        acc[m.chapterNumber]++;
        return acc;
      }, {});

      response = {
        statusCode: 200,
        body: JSON.stringify({ unreadByChapter })
      };
    }

    // ========================================
    // DELETE /sessions/{sessionId} - Delete session
    // ========================================
    else if (httpMethod === 'DELETE' && path.match(/\/sessions\/[^/]+$/)) {
      const sessionId = pathParameters.sessionId;

      await dynamodb.send(new DeleteCommand({
        TableName: process.env.SESSIONS_TABLE,
        Key: { sessionId }
      }));

      // Note: In production, also delete associated messages
      // This would require querying and batch deleting messages

      response = {
        statusCode: 200,
        body: JSON.stringify({ message: 'Session deleted successfully' })
      };
    }

    // ========================================
    // Endpoint not found
    // ========================================
    else {
      response = {
        statusCode: 404,
        body: JSON.stringify({ error: 'Endpoint not found', path, method: httpMethod })
      };
    }

  } catch (error) {
    console.error('Error:', error);
    response = {
      statusCode: 500,
      body: JSON.stringify({ error: error.message, stack: error.stack })
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
