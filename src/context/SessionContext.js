import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import * as sessionsApi from '../utils/sessionsService';
import { isPreviewMode } from '../utils/previewMode';

const SessionContext = createContext();

const REFRESH_INTERVAL_MS = 30000;
const PREVIEW_STORAGE_KEY = 'pagebound-sessions';

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};

// Shape every session the same way for the UI:
//   id (= sessionId), participants[].name, participants[].isMe
export const normalizeSession = (session, myUserId) => ({
  ...session,
  id: session.sessionId || session.id,
  sessionId: session.sessionId || session.id,
  trackingMode: session.trackingMode || 'chapters',
  unreadCount: session.unreadCount || 0,
  newCount: session.newCount || 0,
  newMessageCount: session.newMessageCount || 0,
  waitingCount: session.waitingCount || 0,
  isNewInvite: !!session.isNewInvite,
  unreadVisibleCount: session.unreadVisibleCount || 0,
  participants: (session.participants || []).map(p => ({
    ...p,
    name: p.displayName || p.username || p.name || 'Reader',
    isMe: myUserId ? p.userId === myUserId : p.name === 'You',
    currentChapter: p.currentChapter || 0,
    currentPage: p.currentPage || 0
  }))
});

export const SessionProvider = ({ children }) => {
  const { userProfile } = useAuth();
  const userId = userProfile?.userId;
  const preview = isPreviewMode();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ---- Load ----------------------------------------------------------------
  const refreshSessions = useCallback(async () => {
    if (preview) {
      const saved = JSON.parse(localStorage.getItem(PREVIEW_STORAGE_KEY) || '[]');
      setSessions(saved.map(s => normalizeSession(s, userId)));
      return;
    }
    if (!userId) {
      setSessions([]);
      return;
    }
    try {
      setLoading(true);
      const data = await sessionsApi.getUserSessions(userId);
      setSessions((data.sessions || []).map(s => normalizeSession(s, userId)));
      setError(null);
    } catch (err) {
      console.error('Error loading sessions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [preview, userId]);

  // Load on sign-in, then keep fresh while the app is open
  useEffect(() => {
    refreshSessions();
    if (preview || !userId) return undefined;

    const interval = setInterval(refreshSessions, REFRESH_INTERVAL_MS);
    const onFocus = () => refreshSessions();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [preview, userId, refreshSessions]);

  const savePreview = (next) => {
    localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(next));
    setSessions(next.map(s => normalizeSession(s, userId)));
  };

  const replaceSession = (session) => {
    const normalized = normalizeSession(session, userId);
    setSessions(prev => {
      const exists = prev.some(s => s.id === normalized.id);
      return exists
        // Single-session responses don't carry per-reader counts; keep the list's
        ? prev.map(s => (s.id === normalized.id ? {
          ...s,
          ...normalized,
          unreadCount: s.unreadCount,
          unreadVisibleCount: s.unreadVisibleCount,
          newCount: s.newCount,
          newMessageCount: s.newMessageCount,
          waitingCount: s.waitingCount,
          isNewInvite: s.isNewInvite,
          lastSeenAt: s.lastSeenAt
        } : s))
        : [normalized, ...prev];
    });
    return normalized;
  };

  // ---- Actions -------------------------------------------------------------

  // sessionData: { sessionName, bookTitle, bookAuthor, bookCover, bookIsbn,
  //   totalChapters, totalPages, trackingMode, participantUserIds }
  // Throws ApiError (409 when a reader already has a session for the book).
  const createSession = async (sessionData) => {
    if (preview) {
      const now = new Date().toISOString();
      const session = {
        ...sessionData,
        sessionId: `preview-${Date.now()}`,
        createdAt: now,
        updatedAt: now,
        participants: [{ userId, displayName: 'You', isHost: true, currentChapter: 0, currentPage: 0 }]
      };
      const saved = JSON.parse(localStorage.getItem(PREVIEW_STORAGE_KEY) || '[]');
      savePreview([session, ...saved]);
      return normalizeSession(session, userId);
    }
    const data = await sessionsApi.createSession(sessionData);
    return replaceSession(data.session);
  };

  // Update the signed-in user's own progress
  const updateMyProgress = async (sessionId, { currentChapter, currentPage }) => {
    if (preview) {
      const saved = JSON.parse(localStorage.getItem(PREVIEW_STORAGE_KEY) || '[]');
      savePreview(saved.map(s => ((s.sessionId || s.id) !== sessionId ? s : {
        ...s,
        participants: s.participants.map(p => (
          (userId ? p.userId === userId : p.name === 'You') || p.isHost
            ? { ...p, currentChapter: currentChapter ?? p.currentChapter, currentPage: currentPage ?? p.currentPage }
            : p
        ))
      })));
      return;
    }
    const data = await sessionsApi.updateProgress(sessionId, { currentChapter, currentPage });
    replaceSession(data.session);
  };

  const deleteSession = async (sessionId) => {
    if (preview) {
      const saved = JSON.parse(localStorage.getItem(PREVIEW_STORAGE_KEY) || '[]');
      savePreview(saved.filter(s => (s.sessionId || s.id) !== sessionId));
      return;
    }
    await sessionsApi.deleteSession(sessionId);
    setSessions(prev => prev.filter(s => s.id !== sessionId));
  };

  // Clear a session's notification badge (opening its discussion, etc.)
  const markSeen = async (sessionId) => {
    setSessions(prev => prev.map(s => (s.id === sessionId
      ? { ...s, newCount: 0, newMessageCount: 0, isNewInvite: false, lastSeenAt: new Date().toISOString() }
      : s)));
    if (preview) {
      const saved = JSON.parse(localStorage.getItem(PREVIEW_STORAGE_KEY) || '[]');
      localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(saved.map(s => ((s.sessionId || s.id) === sessionId
        ? { ...s, newCount: 0, newMessageCount: 0, isNewInvite: false, lastSeenAt: new Date().toISOString() }
        : s))));
      return;
    }
    try {
      await sessionsApi.markSessionSeen(sessionId);
    } catch (err) {
      console.error('Error marking session seen:', err);
    }
  };

  // Invite friends (userIds) to an existing session. Throws ApiError.
  const inviteFriends = async (sessionId, userIds) => {
    if (preview) return;
    const data = await sessionsApi.inviteToSession(sessionId, userIds);
    replaceSession(data.session);
  };

  // Leave a session you were invited to. Throws ApiError.
  const leaveSession = async (sessionId) => {
    if (preview) {
      const saved = JSON.parse(localStorage.getItem(PREVIEW_STORAGE_KEY) || '[]');
      savePreview(saved.filter(s => (s.sessionId || s.id) !== sessionId));
      return;
    }
    await sessionsApi.leaveSession(sessionId, userId);
    setSessions(prev => prev.filter(s => s.id !== sessionId));
  };

  const getSessionById = (sessionId) => sessions.find(s => s.id === sessionId);

  // One session per book: the user's session for this book, if any
  const getSessionForBook = (bookIsbn) =>
    bookIsbn ? sessions.find(s => s.bookIsbn === bookIsbn) : undefined;

  // Comments from other readers the user hasn't read yet (across all sessions)
  const unreadTotal = sessions.reduce((sum, s) => sum + (s.unreadCount || 0), 0);

  // What the Sessions tab badge shows: new comments + unopened invitations
  const notificationTotal = sessions.reduce((sum, s) => sum + (s.newCount || 0), 0);

  return (
    <SessionContext.Provider value={{
      sessions,
      loading,
      error,
      refreshSessions,
      createSession,
      updateMyProgress,
      deleteSession,
      getSessionById,
      getSessionForBook,
      unreadTotal,
      notificationTotal,
      markSeen,
      inviteFriends,
      leaveSession
    }}>
      {children}
    </SessionContext.Provider>
  );
};
