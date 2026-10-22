import React, { useEffect, useState } from 'react';
import { getBookReviews, saveReview, deleteReview } from '../utils/socialService';
import { isPreviewMode } from '../utils/previewMode';
import './Reviews.css';

const MAX_REVIEW = 2000;
const PREVIEW_KEY = 'pagebound-preview-reviews';

const previewReviews = () => JSON.parse(localStorage.getItem(PREVIEW_KEY) || '{}');

const shortDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '');

export function Stars({ rating, size = 'sm' }) {
  return (
    <span className={`review-stars is-${size}`} aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(n => <span key={n} className={n <= rating ? 'is-on' : ''} aria-hidden="true">★</span>)}
    </span>
  );
}

// One review. showBook: on profiles, where the book matters more than the author.
export function ReviewCard({ review, showBook = false }) {
  const [expanded, setExpanded] = useState(false);
  const long = (review.text || '').length > 280;
  const text = expanded || !long ? review.text : `${review.text.slice(0, 280).replace(/\s+\S*$/, '')}…`;

  return (
    <article className="review-card">
      <header className="review-card-header">
        {showBook ? (
          <>
            {review.book?.coverUrl && <img className="review-card-cover" src={review.book.coverUrl} alt="" />}
            <div className="review-card-who">
              <strong className="review-card-title">{review.book?.title}</strong>
              <span className="review-card-meta"><Stars rating={review.rating} /> · {shortDate(review.updatedAt)}</span>
            </div>
          </>
        ) : (
          <>
            {review.author?.avatarUrl
              ? <img className="review-card-avatar" src={review.author.avatarUrl} alt="" />
              : <span className="review-card-avatar avatar-placeholder" aria-hidden="true">{review.author?.displayName?.charAt(0) || '?'}</span>}
            <div className="review-card-who">
              <strong>{review.author?.isMe ? 'You' : review.author?.displayName}</strong>
              <span className="review-card-meta"><Stars rating={review.rating} /> · {shortDate(review.updatedAt)}</span>
            </div>
          </>
        )}
      </header>
      {review.text && <p className="review-card-text">{text}</p>}
      {long && (
        <button type="button" className="link-button review-card-more" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </article>
  );
}

// Everyone's reviews of a book (search preview)
export function BookReviews({ isbn, limit = 3 }) {
  const [data, setData] = useState(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (isPreviewMode()) {
      const mine = previewReviews()[isbn];
      setData({ reviews: mine && mine.text ? [mine] : [], count: mine ? 1 : 0, average: mine?.rating || null });
      return undefined;
    }
    getBookReviews(isbn)
      .then(d => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData({ reviews: [], count: 0, average: null, failed: true }); });
    return () => { cancelled = true; };
  }, [isbn]);

  if (!data) return <p className="review-muted">Loading reviews…</p>;

  const shown = showAll ? data.reviews : data.reviews.slice(0, limit);
  return (
    <div className="book-reviews">
      {data.count ? (
        <p className="review-summary">
          <Stars rating={Math.round(data.average)} size="md" />
          <strong>{data.average}</strong> from {data.count} Pagebound reader{data.count !== 1 ? 's' : ''}
        </p>
      ) : (
        <p className="review-muted">{data.failed ? "Couldn't load reviews." : 'No Pagebound reviews yet.'}</p>
      )}
      {shown.map(r => <ReviewCard key={`${r.author?.userId || 'anon'}-${r.updatedAt}`} review={r} />)}
      {data.reviews.length > limit && (
        <button type="button" className="link-button" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show fewer' : `Show all ${data.reviews.length} reviews`}
        </button>
      )}
    </div>
  );
}

// Write / edit / delete your own review (book sheet). onRated(stars) keeps
// the library card's rating in step.
export function MyReviewEditor({ book, onRated }) {
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(null);
  const [rating, setRating] = useState(book.rating || 0);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const apply = (mine) => {
      if (cancelled) return;
      setSaved(mine || null);
      if (mine) {
        setRating(mine.rating);
        setText(mine.text || '');
      }
      setLoaded(true);
    };
    if (isPreviewMode()) {
      apply(previewReviews()[book.isbn]);
    } else {
      getBookReviews(book.isbn).then(d => apply(d.mine)).catch(() => apply(null));
    }
    return () => { cancelled = true; };
  }, [book.isbn]);

  const handleSave = async () => {
    if (!rating) {
      setError('Pick a star rating first.');
      return;
    }
    try {
      setBusy(true);
      setError(null);
      const bookCard = { title: book.title, author: book.author, coverUrl: book.coverUrl };
      let review;
      if (isPreviewMode()) {
        review = {
          isbn: book.isbn, rating, text: text.trim(), book: { isbn: book.isbn, ...bookCard },
          updatedAt: new Date().toISOString(), author: { displayName: 'You', isMe: true }
        };
        localStorage.setItem(PREVIEW_KEY, JSON.stringify({ ...previewReviews(), [book.isbn]: review }));
      } else {
        review = (await saveReview(book.isbn, { rating, text: text.trim(), book: bookCard })).review;
      }
      setSaved(review);
      setEditing(false);
      if (onRated) onRated(rating);
    } catch (err) {
      setError(err.message || 'Could not save your review.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    try {
      setBusy(true);
      setError(null);
      if (isPreviewMode()) {
        const all = previewReviews();
        delete all[book.isbn];
        localStorage.setItem(PREVIEW_KEY, JSON.stringify(all));
      } else {
        await deleteReview(book.isbn);
      }
      setSaved(null);
      setText('');
      setEditing(false);
    } catch (err) {
      setError(err.message || 'Could not delete your review.');
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return <p className="review-muted">Loading your review…</p>;

  if (saved && !editing) {
    return (
      <div className="my-review">
        <ReviewCard review={{ ...saved, author: { displayName: 'You', isMe: true } }} />
        <div className="my-review-actions">
          <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(true)}>Edit review</button>
        </div>
      </div>
    );
  }

  return (
    <div className="my-review">
      <div className="star-picker" role="radiogroup" aria-label="Your rating">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n !== 1 ? 's' : ''}`}
            className={n <= rating ? 'is-on' : ''}
            onClick={() => setRating(n)}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        className="message-input"
        rows={4}
        maxLength={MAX_REVIEW}
        placeholder="What did you think? (optional)"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="my-review-footer">
        <span className="review-muted">{text.length}/{MAX_REVIEW}</span>
        <div className="my-review-actions">
          {saved && (
            <button type="button" className="btn-danger btn-sm" onClick={handleDelete} disabled={busy}>Delete</button>
          )}
          {saved && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => { setEditing(false); setRating(saved.rating); setText(saved.text || ''); }} disabled={busy}>
              Cancel
            </button>
          )}
          <button type="button" className="btn-primary btn-sm" onClick={handleSave} disabled={busy}>
            {busy ? 'Saving…' : saved ? 'Save changes' : 'Post review'}
          </button>
        </div>
      </div>
      {error && <div className="error-message">{error}</div>}
    </div>
  );
}
