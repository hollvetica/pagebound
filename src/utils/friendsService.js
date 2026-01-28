// Friends service for API operations
const API_ENDPOINT = process.env.REACT_APP_API_ENDPOINT;

// Get list of friends for a user
export const getFriendsList = async (userId) => {
  try {
    const response = await fetch(`${API_ENDPOINT}/friends/${userId}/list`);
    if (!response.ok) throw new Error('Failed to fetch friends list');
    return await response.json();
  } catch (error) {
    console.error('Error fetching friends list:', error);
    return { friends: [], count: 0 };
  }
};

// Get pending friend requests (sent and received)
export const getFriendRequests = async (userId) => {
  try {
    const response = await fetch(`${API_ENDPOINT}/friends/${userId}/requests`);
    if (!response.ok) throw new Error('Failed to fetch friend requests');
    return await response.json();
  } catch (error) {
    console.error('Error fetching friend requests:', error);
    return { received: [], sent: [] };
  }
};

// Send a friend request by username
export const sendFriendRequest = async (userId, toUsername, message = '') => {
  try {
    const response = await fetch(`${API_ENDPOINT}/friends/${userId}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toUsername, message })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send friend request');
    }
    return await response.json();
  } catch (error) {
    console.error('Error sending friend request:', error);
    throw error;
  }
};

// Accept or reject a friend request
export const respondToFriendRequest = async (userId, fromUserId, action) => {
  try {
    const response = await fetch(`${API_ENDPOINT}/friends/${userId}/requests/${fromUserId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }) // 'accept' or 'reject'
    });
    if (!response.ok) throw new Error('Failed to respond to friend request');
    return await response.json();
  } catch (error) {
    console.error('Error responding to friend request:', error);
    throw error;
  }
};

// Remove a friend
export const removeFriend = async (userId, friendUserId) => {
  try {
    const response = await fetch(`${API_ENDPOINT}/friends/${userId}/remove/${friendUserId}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to remove friend');
    return await response.json();
  } catch (error) {
    console.error('Error removing friend:', error);
    throw error;
  }
};

// Search for users by username
export const searchUsers = async (userId, searchQuery) => {
  try {
    const response = await fetch(`${API_ENDPOINT}/friends/${userId}/search?q=${encodeURIComponent(searchQuery)}`);
    if (!response.ok) throw new Error('Failed to search users');
    return await response.json();
  } catch (error) {
    console.error('Error searching users:', error);
    return { users: [] };
  }
};

// Create an invite link
export const createInviteLink = async (userId, expiresInDays = null, maxUses = null) => {
  try {
    const response = await fetch(`${API_ENDPOINT}/friends/${userId}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresInDays, maxUses })
    });
    if (!response.ok) throw new Error('Failed to create invite link');
    return await response.json();
  } catch (error) {
    console.error('Error creating invite link:', error);
    throw error;
  }
};

// Get invite link info
export const getInviteInfo = async (userId, inviteCode) => {
  try {
    const response = await fetch(`${API_ENDPOINT}/friends/${userId}/invite/${inviteCode}`);
    if (!response.ok) throw new Error('Failed to fetch invite info');
    return await response.json();
  } catch (error) {
    console.error('Error fetching invite info:', error);
    throw error;
  }
};
