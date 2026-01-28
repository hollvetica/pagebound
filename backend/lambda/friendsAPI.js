// friendsAPI Lambda Function
// Handles all friend-related API requests via API Gateway

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, QueryCommand, ScanCommand, UpdateCommand, BatchGetCommand } = require("@aws-sdk/lib-dynamodb");
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

// Helper function to get user profile data (for caching)
function getUserProfileData(user) {
  return {
    userId: user.userId,
    username: user.username,
    displayName: user.displayName || user.username,
    avatarUrl: user.avatarUrl || null,
    email: user.email,
    isPrivate: user.isPrivate || false
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
    // GET /friends/{userId}/list - Get friends list
    // ========================================
    if (httpMethod === 'GET' && path.match(/\/friends\/[^/]+\/list$/)) {
      const userId = pathParameters.userId;

      // Query friends where user is the primary
      const friendsResult = await dynamodb.send(new QueryCommand({
        TableName: process.env.FRIENDS_TABLE,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        }
      }));

      const friends = friendsResult.Items || [];

      // Optionally fetch fresh user data for each friend
      const friendsWithDetails = await Promise.all(
        friends.map(async (friend) => {
          const freshData = await getUserByUserId(friend.friendUserId);
          return {
            ...friend,
            // Update with fresh data if available
            friendUsername: freshData?.username || friend.friendUsername,
            friendDisplayName: freshData?.displayName || friend.friendDisplayName,
            friendAvatarUrl: freshData?.avatarUrl || friend.friendAvatarUrl,
            isPrivate: freshData?.isPrivate || false
          };
        })
      );

      response = {
        statusCode: 200,
        body: JSON.stringify({
          friends: friendsWithDetails,
          count: friendsWithDetails.length
        })
      };
    }

    // ========================================
    // GET /friends/{userId}/requests - Get pending friend requests
    // ========================================
    else if (httpMethod === 'GET' && path.match(/\/friends\/[^/]+\/requests$/)) {
      const userId = pathParameters.userId;

      // Get requests TO this user (pending)
      const receivedRequestsResult = await dynamodb.send(new QueryCommand({
        TableName: process.env.FRIEND_REQUESTS_TABLE,
        KeyConditionExpression: 'toUserId = :userId',
        FilterExpression: '#status = :pending',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':userId': userId,
          ':pending': 'pending'
        }
      }));

      // Get requests FROM this user (pending)
      const sentRequestsResult = await dynamodb.send(new QueryCommand({
        TableName: process.env.FRIEND_REQUESTS_TABLE,
        IndexName: 'fromUserId-index',
        KeyConditionExpression: 'fromUserId = :userId',
        FilterExpression: '#status = :pending',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':userId': userId,
          ':pending': 'pending'
        }
      }));

      response = {
        statusCode: 200,
        body: JSON.stringify({
          received: receivedRequestsResult.Items || [],
          sent: sentRequestsResult.Items || []
        })
      };
    }

    // ========================================
    // POST /friends/{userId}/requests - Send friend request
    // ========================================
    else if (httpMethod === 'POST' && path.match(/\/friends\/[^/]+\/requests$/)) {
      const fromUserId = pathParameters.userId;
      const body = JSON.parse(event.body);
      const { toUsername, message } = body;

      // Find the target user by username
      const targetUserResult = await dynamodb.send(new QueryCommand({
        TableName: process.env.USERS_TABLE,
        IndexName: 'username-index',
        KeyConditionExpression: 'username = :username',
        ExpressionAttributeValues: {
          ':username': toUsername
        }
      }));

      if (!targetUserResult.Items || targetUserResult.Items.length === 0) {
        response = {
          statusCode: 404,
          body: JSON.stringify({ error: 'User not found' })
        };
      } else {
        const toUser = targetUserResult.Items[0];
        const toUserId = toUser.userId;

        // Check if they're the same user
        if (fromUserId === toUserId) {
          response = {
            statusCode: 400,
            body: JSON.stringify({ error: 'Cannot send friend request to yourself' })
          };
        } else {
          // Check if already friends
          const existingFriendship = await dynamodb.send(new GetCommand({
            TableName: process.env.FRIENDS_TABLE,
            Key: { userId: fromUserId, friendUserId: toUserId }
          }));

          if (existingFriendship.Item) {
            response = {
              statusCode: 400,
              body: JSON.stringify({ error: 'Already friends' })
            };
          } else {
            // Check if request already exists
            const existingRequest = await dynamodb.send(new GetCommand({
              TableName: process.env.FRIEND_REQUESTS_TABLE,
              Key: { toUserId, fromUserId }
            }));

            if (existingRequest.Item && existingRequest.Item.status === 'pending') {
              response = {
                statusCode: 400,
                body: JSON.stringify({ error: 'Friend request already sent' })
              };
            } else {
              // Get sender profile data
              const fromUser = await getUserByUserId(fromUserId);

              // Create friend request
              await dynamodb.send(new PutCommand({
                TableName: process.env.FRIEND_REQUESTS_TABLE,
                Item: {
                  toUserId,
                  fromUserId,
                  status: 'pending',
                  message: message || '',
                  createdAt: new Date().toISOString(),
                  fromUsername: fromUser.username,
                  fromDisplayName: fromUser.displayName || fromUser.username,
                  fromAvatarUrl: fromUser.avatarUrl || null
                }
              }));

              response = {
                statusCode: 200,
                body: JSON.stringify({ message: 'Friend request sent successfully' })
              };
            }
          }
        }
      }
    }

    // ========================================
    // PUT /friends/{userId}/requests/{fromUserId} - Accept/Reject request
    // ========================================
    else if (httpMethod === 'PUT' && path.match(/\/friends\/[^/]+\/requests\/[^/]+$/)) {
      const toUserId = pathParameters.userId;
      const fromUserId = pathParameters.fromUserId;
      const body = JSON.parse(event.body);
      const { action } = body; // 'accept' or 'reject'

      // Get the friend request
      const requestResult = await dynamodb.send(new GetCommand({
        TableName: process.env.FRIEND_REQUESTS_TABLE,
        Key: { toUserId, fromUserId }
      }));

      if (!requestResult.Item) {
        response = {
          statusCode: 404,
          body: JSON.stringify({ error: 'Friend request not found' })
        };
      } else if (requestResult.Item.status !== 'pending') {
        response = {
          statusCode: 400,
          body: JSON.stringify({ error: 'Friend request already processed' })
        };
      } else {
        if (action === 'accept') {
          // Get both users' full data
          const [fromUser, toUser] = await Promise.all([
            getUserByUserId(fromUserId),
            getUserByUserId(toUserId)
          ]);

          // Create bidirectional friendship
          await Promise.all([
            // Add friend relationship (user1 -> user2)
            dynamodb.send(new PutCommand({
              TableName: process.env.FRIENDS_TABLE,
              Item: {
                userId: toUserId,
                friendUserId: fromUserId,
                status: 'accepted',
                createdAt: new Date().toISOString(),
                friendUsername: fromUser.username,
                friendDisplayName: fromUser.displayName || fromUser.username,
                friendAvatarUrl: fromUser.avatarUrl || null
              }
            })),
            // Add friend relationship (user2 -> user1)
            dynamodb.send(new PutCommand({
              TableName: process.env.FRIENDS_TABLE,
              Item: {
                userId: fromUserId,
                friendUserId: toUserId,
                status: 'accepted',
                createdAt: new Date().toISOString(),
                friendUsername: toUser.username,
                friendDisplayName: toUser.displayName || toUser.username,
                friendAvatarUrl: toUser.avatarUrl || null
              }
            })),
            // Update request status
            dynamodb.send(new UpdateCommand({
              TableName: process.env.FRIEND_REQUESTS_TABLE,
              Key: { toUserId, fromUserId },
              UpdateExpression: 'SET #status = :accepted',
              ExpressionAttributeNames: {
                '#status': 'status'
              },
              ExpressionAttributeValues: {
                ':accepted': 'accepted'
              }
            })),
            // Increment friend counts
            dynamodb.send(new UpdateCommand({
              TableName: process.env.USERS_TABLE,
              Key: { email: fromUser.email },
              UpdateExpression: 'SET friendsCount = if_not_exists(friendsCount, :zero) + :inc',
              ExpressionAttributeValues: {
                ':zero': 0,
                ':inc': 1
              }
            })),
            dynamodb.send(new UpdateCommand({
              TableName: process.env.USERS_TABLE,
              Key: { email: toUser.email },
              UpdateExpression: 'SET friendsCount = if_not_exists(friendsCount, :zero) + :inc',
              ExpressionAttributeValues: {
                ':zero': 0,
                ':inc': 1
              }
            }))
          ]);

          response = {
            statusCode: 200,
            body: JSON.stringify({ message: 'Friend request accepted' })
          };
        } else if (action === 'reject') {
          // Update request status to rejected
          await dynamodb.send(new UpdateCommand({
            TableName: process.env.FRIEND_REQUESTS_TABLE,
            Key: { toUserId, fromUserId },
            UpdateExpression: 'SET #status = :rejected',
            ExpressionAttributeNames: {
              '#status': 'status'
            },
            ExpressionAttributeValues: {
              ':rejected': 'rejected'
            }
          }));

          response = {
            statusCode: 200,
            body: JSON.stringify({ message: 'Friend request rejected' })
          };
        } else {
          response = {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid action. Use "accept" or "reject"' })
          };
        }
      }
    }

    // ========================================
    // DELETE /friends/{userId}/remove/{friendUserId} - Remove friend
    // ========================================
    else if (httpMethod === 'DELETE' && path.match(/\/friends\/[^/]+\/remove\/[^/]+$/)) {
      const userId = pathParameters.userId;
      const friendUserId = pathParameters.friendUserId;

      // Get both users
      const [user, friendUser] = await Promise.all([
        getUserByUserId(userId),
        getUserByUserId(friendUserId)
      ]);

      // Delete bidirectional friendship
      await Promise.all([
        dynamodb.send(new DeleteCommand({
          TableName: process.env.FRIENDS_TABLE,
          Key: { userId, friendUserId }
        })),
        dynamodb.send(new DeleteCommand({
          TableName: process.env.FRIENDS_TABLE,
          Key: { userId: friendUserId, friendUserId: userId }
        })),
        // Decrement friend counts
        dynamodb.send(new UpdateCommand({
          TableName: process.env.USERS_TABLE,
          Key: { email: user.email },
          UpdateExpression: 'SET friendsCount = if_not_exists(friendsCount, :one) - :dec',
          ExpressionAttributeValues: {
            ':one': 1,
            ':dec': 1
          }
        })),
        dynamodb.send(new UpdateCommand({
          TableName: process.env.USERS_TABLE,
          Key: { email: friendUser.email },
          UpdateExpression: 'SET friendsCount = if_not_exists(friendsCount, :one) - :dec',
          ExpressionAttributeValues: {
            ':one': 1,
            ':dec': 1
          }
        }))
      ]);

      response = {
        statusCode: 200,
        body: JSON.stringify({ message: 'Friend removed successfully' })
      };
    }

    // ========================================
    // GET /friends/{userId}/search?q=query - Search users by username
    // ========================================
    else if (httpMethod === 'GET' && path.match(/\/friends\/[^/]+\/search$/)) {
      const userId = pathParameters.userId;
      const searchQuery = queryStringParameters.q || '';

      if (!searchQuery || searchQuery.length < 2) {
        response = {
          statusCode: 400,
          body: JSON.stringify({ error: 'Search query must be at least 2 characters' })
        };
      } else {
        // Scan users table for matching usernames
        const scanResult = await dynamodb.send(new ScanCommand({
          TableName: process.env.USERS_TABLE,
          FilterExpression: 'contains(#username, :query)',
          ExpressionAttributeNames: {
            '#username': 'username'
          },
          ExpressionAttributeValues: {
            ':query': searchQuery
          },
          Limit: 20 // Limit results
        }));

        // Filter out private profiles and the current user
        const users = (scanResult.Items || [])
          .filter(user => user.userId !== userId && !user.isPrivate)
          .map(user => ({
            userId: user.userId,
            username: user.username,
            displayName: user.displayName || user.username,
            avatarUrl: user.avatarUrl || null,
            friendsCount: user.friendsCount || 0
          }));

        response = {
          statusCode: 200,
          body: JSON.stringify({ users })
        };
      }
    }

    // ========================================
    // POST /friends/{userId}/invite - Create invite link
    // ========================================
    else if (httpMethod === 'POST' && path.match(/\/friends\/[^/]+\/invite$/)) {
      const userId = pathParameters.userId;
      const body = event.body ? JSON.parse(event.body) : {};
      const { expiresInDays, maxUses } = body;

      const inviteCode = randomUUID();
      const createdAt = new Date();
      const expiresAt = expiresInDays
        ? new Date(createdAt.getTime() + expiresInDays * 24 * 60 * 60 * 1000).getTime() / 1000
        : null; // TTL needs to be in seconds (epoch)

      await dynamodb.send(new PutCommand({
        TableName: process.env.INVITE_LINKS_TABLE,
        Item: {
          inviteCode,
          userId,
          createdAt: createdAt.toISOString(),
          expiresAt: expiresAt,
          usedCount: 0,
          maxUses: maxUses || null
        }
      }));

      const inviteUrl = `https://pagebound.app/invite/${inviteCode}`;

      response = {
        statusCode: 200,
        body: JSON.stringify({
          inviteCode,
          inviteUrl,
          expiresAt: expiresAt ? new Date(expiresAt * 1000).toISOString() : null
        })
      };
    }

    // ========================================
    // GET /friends/{userId}/invite/{inviteCode} - Get invite info
    // ========================================
    else if (httpMethod === 'GET' && path.match(/\/friends\/[^/]+\/invite\/[^/]+$/)) {
      const inviteCode = pathParameters.inviteCode;

      const inviteResult = await dynamodb.send(new GetCommand({
        TableName: process.env.INVITE_LINKS_TABLE,
        Key: { inviteCode }
      }));

      if (!inviteResult.Item) {
        response = {
          statusCode: 404,
          body: JSON.stringify({ error: 'Invite not found or expired' })
        };
      } else {
        const invite = inviteResult.Item;

        // Check if expired or max uses reached
        if (invite.maxUses && invite.usedCount >= invite.maxUses) {
          response = {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invite link has reached maximum uses' })
          };
        } else {
          // Get the inviter's profile
          const inviter = await getUserByUserId(invite.userId);

          response = {
            statusCode: 200,
            body: JSON.stringify({
              inviteCode: invite.inviteCode,
              inviter: {
                userId: inviter.userId,
                username: inviter.username,
                displayName: inviter.displayName || inviter.username,
                avatarUrl: inviter.avatarUrl || null
              },
              usedCount: invite.usedCount,
              maxUses: invite.maxUses
            })
          };

          // Optionally increment used count
          // await dynamodb.send(new UpdateCommand({
          //   TableName: process.env.INVITE_LINKS_TABLE,
          //   Key: { inviteCode },
          //   UpdateExpression: 'SET usedCount = usedCount + :inc',
          //   ExpressionAttributeValues: { ':inc': 1 }
          // }));
        }
      }
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
