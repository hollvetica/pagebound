import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from '../context/SessionContext';
import { useAuth } from '../context/AuthContext';
import { useFriends } from '../context/FriendsContext';
import { getFeed, setReaction } from '../utils/socialService';
import { addBookToLibrary } from '../utils/libraryService';
import { isPreviewMode } from '../utils/previewMode';
import ActiveSessions from '../components/ActiveSessions';
import ActivityFeed from '../components/ActivityFeed';
import QuickSessionSetup from '../components/QuickSessionSetup';
import './Home.css';

const REFRESH_MS = 60000;
const DEFAULT_REACTIONS = ['❤️', '🔥', '😂', '😮', '📚'];
const PREVIEW_FEED_KEY = 'pagebound-preview-feed';

function Home() {
  const { sessions, createSession } = useSession();
  const { userProfile } = useAuth();
  const { friends } = useFriends();
  const preview = isPreviewMode();

  const [feed, setFeed] = useState([]);
  const [reactionSet, setReactionSet] = useState(DEFAULT_REACTIONS);
  const [feedLoading, setFeedLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState(null);

  const loadFeed = useCallback(async () => {
    if (preview) {
      setFeed(JSON.parse(localStorage.getItem(PREVIEW_FEED_KEY) || '[]'));
      setFeedLoading(false);
      return;
    }
    try {
      const data = await getFeed();
      setFeed(data.items || []);
      if (data.reactionSet) setReactionSet(data.reactionSet);
    } catch (err) {
      console.error('Error loading feed:', err);
    } finally {
      setFeedLoading(false);
    }
  }, [preview]);

  useEffect(() => {
    loadFeed();
    const interval = setInterval(loadFeed, REFRESH_MS);
    return () => clearInterval(interval);
  }, [loadFeed]);

  // Optimistic: update counts right away, then take the server's numbers
  const handleReact = async (item, emoji) => {
    const apply = (reactions) => setFeed(prev => prev.map(i => (i.itemId === item.itemId ? { ...i, reactions } : i)));
    const { counts = {}, mine = null } = item.reactions || {};
    const next = { ...counts };
    if (mine) next[mine] = Math.max(0, (next[mine] || 1) - 1);
    if (emoji) next[emoji] = (next[emoji] || 0) + 1;
    Object.keys(next).forEach(k => { if (!next[k]) delete next[k]; });
    apply({ counts: next, mine: emoji });

    if (preview) return;
    try {
      const data = await setReaction(item.itemId, emoji);
      apply(data.reactions);
    } catch (err) {
      console.error('Error reacting:', err);
      apply(item.reactions);
    }
  };

  const handleAddToLibrary = async (book) => {
    if (preview) return;
    await addBookToLibrary(userProfile.userId, { ...book, shelf: 'Want to Read', addedAt: new Date().toISOString() });
  };

  // QuickSessionSetup works from { friend, book, bookIsbn, ... }
  const handleSuggestSession = (item) => {
    setSelectedActivity({
      friend: item.actor.displayName,
      friendUserId: item.actor.userId,
      book: item.book.title,
      bookIsbn: item.book.isbn,
      bookAuthor: item.book.author,
      bookCover: item.book.coverUrl
    });
  };

  // Errors (e.g. already in a session for this book) are shown in the sheet
  const handleCreateQuickSession = async (sessionData) => {
    await createSession(sessionData);
    setSelectedActivity(null);
  };

  const name = userProfile?.displayName || userProfile?.username || 'reader';

  return (
    <div className="page home-page">
      <div className="home-header">
        <h2>Welcome back, {name}!</h2>
        <div className="friend-count">
          <span className="friend-icon">👥</span>
          <p>{friends.length} friend{friends.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {sessions.length > 0 ? (
        <ActiveSessions sessions={sessions} />
      ) : (
        <div className="no-sessions">
          <h3>No Active Sessions</h3>
          <p>Start a reading session from your library or join a friend below!</p>
        </div>
      )}

      <ActivityFeed
        items={feed}
        reactionSet={reactionSet}
        loading={feedLoading}
        onReact={handleReact}
        onSuggestSession={handleSuggestSession}
        onAddToLibrary={handleAddToLibrary}
      />

      {selectedActivity && (
        <QuickSessionSetup
          activity={selectedActivity}
          onClose={() => setSelectedActivity(null)}
          onCreateSession={handleCreateQuickSession}
        />
      )}
    </div>
  );
}

export default Home;
