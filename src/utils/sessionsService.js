// Sessions service: shared reading sessions and their discussions.
// The API identifies the caller from the login token, so no userId is sent
// for actions; it is only part of the "list my sessions" path.
import { apiJson } from './apiFetch';

// Create a session. Throws ApiError (status 409 if a reader already has a
// session for this book, 403 if an invitee isn't a friend).
export const createSession = (sessionData) =>
  apiJson('/sessions', { method: 'POST', body: JSON.stringify(sessionData) });

// Sessions the user is part of, each with unreadCount / unreadVisibleCount
export const getUserSessions = (userId) =>
  apiJson(`/sessions/users/${encodeURIComponent(userId)}/list`);

export const getSession = (sessionId) =>
  apiJson(`/sessions/${sessionId}`);

// Update the signed-in user's own progress
export const updateProgress = (sessionId, { currentChapter, currentPage }) =>
  apiJson(`/sessions/${sessionId}/progress`, {
    method: 'PUT',
    body: JSON.stringify({ currentChapter, currentPage })
  });

// Post a comment tagged to a chapter or page (whichever the session tracks)
export const postMessage = (sessionId, message, position) =>
  apiJson(`/sessions/${sessionId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message, position })
  });

// { visibleMessages, hiddenMessages, userPosition, trackingMode }
export const getMessages = (sessionId) =>
  apiJson(`/sessions/${sessionId}/messages`);

export const markMessageAsRead = (sessionId, messageId) =>
  apiJson(`/sessions/${sessionId}/messages/${messageId}/read`, { method: 'PUT' });

// { unreadByPosition: { [position]: count } }
export const getUnreadTimeline = (sessionId) =>
  apiJson(`/sessions/${sessionId}/unread-timeline`);

export const deleteSession = (sessionId) =>
  apiJson(`/sessions/${sessionId}`, { method: 'DELETE' });

// The reader has caught up on a session (clears its notification badge)
export const markSessionSeen = (sessionId) =>
  apiJson(`/sessions/${sessionId}/seen`, { method: 'PUT' });

// Invite friends (userIds) to an existing session
export const inviteToSession = (sessionId, userIds) =>
  apiJson(`/sessions/${sessionId}/participants`, {
    method: 'POST',
    body: JSON.stringify({ userIds })
  });

// Leave a session you were invited to
export const leaveSession = (sessionId, userId) =>
  apiJson(`/sessions/${sessionId}/participants/${encodeURIComponent(userId)}`, { method: 'DELETE' });
