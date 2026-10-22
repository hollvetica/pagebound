import React from 'react';
import { User } from 'lucide-react';
import BookRating from './BookRating';
import './BookCard.css';

// A book on a shelf. When the reader has a session for it, the progress bar
// shows their session progress with the participant count beside it, and a
// badge on the cover counts comments waiting for them.
function BookCard({ book, session, theme, onOpen, onRatingChange }) {
  let percent = null;
  if (session) {
    const byPages = session.trackingMode === 'pages';
    const me = session.participants.find(p => p.isMe) || session.participants.find(p => p.isHost);
    const current = (byPages ? me?.currentPage : me?.currentChapter) || 0;
    const total = (byPages ? session.totalPages : session.totalChapters) || 0;
    percent = total ? Math.min(100, Math.round((current / total) * 100)) : 0;
  } else if (book.shelf === 'Currently Reading' && book.progress) {
    percent = book.progress;
  }

  const unread = session?.unreadCount || 0;
  const readers = session?.participants?.length || 0;

  return (
    <div
      className="book-card"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(book)}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(book); }}
    >
      <div className="book-card-cover">
        {book.coverUrl ? <img src={book.coverUrl} alt={book.title} /> : '📚'}
        {unread > 0 && (
          <span className="book-card-badge" title={`${unread} new comment${unread !== 1 ? 's' : ''}`}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </div>

      {(percent !== null || session) && (
        <div className="book-card-progress">
          <div className="book-progress-bar">
            <div className="book-progress-fill" style={{ width: `${percent || 0}%` }} />
          </div>
          {session && (
            <span className="book-card-readers" title={`${readers} reader${readers !== 1 ? 's' : ''} in this session`}>
              <User size={12} fill="currentColor" strokeWidth={0} aria-hidden="true" />
              {readers}
            </span>
          )}
        </div>
      )}

      <div className="book-card-info">
        <h4>{book.title}</h4>
        <p>{book.author}</p>
        <div className="book-card-rating" onClick={(e) => e.stopPropagation()}>
          <BookRating
            rating={book.rating || 0}
            onRatingChange={(rating) => onRatingChange(book.isbn, rating)}
            theme={theme}
            size="small"
            interactive={true}
          />
        </div>
      </div>
    </div>
  );
}

export default BookCard;
