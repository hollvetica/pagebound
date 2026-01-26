import React, { createContext, useState, useContext, useEffect } from 'react';

const SessionContext = createContext();

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};

export const SessionProvider = ({ children }) => {
  // Load sessions from localStorage or use empty array
  const [sessions, setSessions] = useState(() => {
    const savedSessions = localStorage.getItem('pagebound-sessions');
    return savedSessions ? JSON.parse(savedSessions) : [];
  });

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('pagebound-sessions', JSON.stringify(sessions));
  }, [sessions]);

  const createSession = (sessionData) => {
    setSessions([...sessions, sessionData]);
  };

  const updateSession = (sessionId, updates) => {
    setSessions(sessions.map(session => 
      session.id === sessionId 
        ? { ...session, ...updates }
        : session
    ));
  };

  const deleteSession = (sessionId) => {
    setSessions(sessions.filter(session => session.id !== sessionId));
  };

  const updateParticipantProgress = (sessionId, participantName, newChapter) => {
    setSessions(sessions.map(session => {
      if (session.id === sessionId) {
        return {
          ...session,
          participants: session.participants.map(participant =>
            participant.name === participantName
              ? { ...participant, currentChapter: newChapter }
              : participant
          )
        };
      }
      return session;
    }));
  };

  const getSessionById = (sessionId) => {
    return sessions.find(session => session.id === sessionId);
  };

  return (
    <SessionContext.Provider value={{ 
      sessions, 
      createSession, 
      updateSession, 
      deleteSession,
      updateParticipantProgress,
      getSessionById
    }}>
      {children}
    </SessionContext.Provider>
  );
};
