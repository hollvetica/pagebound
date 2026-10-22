// Sessions service for API operations
const API_ENDPOINT = process.env.REACT_APP_API_ENDPOINT;

// Create a new reading session
export const createSession = async (sessionData) => {
  try {
    const response = await fetch(`${API_ENDPOINT}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionData)
    });
    if (!response.ok) throw new Error('Failed to create session');
    return await response.json();
  } catch (error) {
    console.error('Error creating session:', error);
    throw error;
  }
};

// Get list of sessions for a user
export const getUserSessions = async (userId) => {
  try {
    const response = await fetch(`${API_ENDPOINT}/sessions/${userId}/list`);
    if (!response.ok) throw new Error('Failed to fetch sessions');
    return await response.json();
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return { sessions: [] };
  }
};

// Get a specific session by ID
export const getSession = async (sessionId) => {
  try {
    const response = await fetch(`${API_ENDPOINT}/sessions/${sessionId}`);
    if (!response.ok) throw new Error('Failed to fetch session');
    return await response.json();
  } catch (error) {
    console.error('Error fetching session:', error);
    throw error;
  }
};

// Update participant progress in a session
export const updateProgress = async (sessionId, userId, currentChapter, currentPage = 0) => {
  try {
    const response = await fetch(`${API_ENDPOINT}/sessions/${sessionId}/progress`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, currentChapter, currentPage })
    });
    if (!response.ok) throw new Error('Failed to update progress');
    return await response.json();
  } catch (error) {
    console.error('Error updating progress:', error);
    throw error;
  }
};

// Post a message to session discussion
export const postMessage = async (sessionId, userId, message, chapterNumber) => {
  try {
    const response = await fetch(`${API_ENDPOINT}/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, message, chapterNumber })
    });
    if (!response.ok) throw new Error('Failed to post message');
    return await response.json();
  } catch (error) {
    console.error('Error posting message:', error);
    throw error;
  }
};

// Get messages for a session (filtered by user's progress)
export const getMessages = async (sessionId, userId) => {
  try {
    const response = await fetch(`${API_ENDPOINT}/sessions/${sessionId}/messages?userId=${userId}`);
    if (!response.ok) throw new Error('Failed to fetch messages');
    return await response.json();
  } catch (error) {
    console.error('Error fetching messages:', error);
    return { visibleMessages: [], hiddenMessages: [], userCurrentChapter: 0 };
  }
};

// Mark a message as read
export const markMessageAsRead = async (sessionId, messageId, userId) => {
  try {
    const response = await fetch(`${API_ENDPOINT}/sessions/${sessionId}/messages/${messageId}/read`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    if (!response.ok) throw new Error('Failed to mark message as read');
    return await response.json();
  } catch (error) {
    console.error('Error marking message as read:', error);
    throw error;
  }
};

// Get unread message timeline indicators
export const getUnreadTimeline = async (sessionId, userId) => {
  try {
    const response = await fetch(`${API_ENDPOINT}/sessions/${sessionId}/unread-timeline?userId=${userId}`);
    if (!response.ok) throw new Error('Failed to fetch unread timeline');
    return await response.json();
  } catch (error) {
    console.error('Error fetching unread timeline:', error);
    return { unreadByChapter: {} };
  }
};

// Delete a session
export const deleteSession = async (sessionId) => {
  try {
    const response = await fetch(`${API_ENDPOINT}/sessions/${sessionId}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete session');
    return await response.json();
  } catch (error) {
    console.error('Error deleting session:', error);
    throw error;
  }
};
