import React, { useEffect, useState } from 'react';
import { BookOpen, Users } from 'lucide-react';
import { getBookStats } from '../utils/libraryService';
import { isPreviewMode } from '../utils/previewMode';
import './BookPreview.css';

const SYNOPSIS_PREVIEW_CHARS = 420;

// Open Library work details for results that came from Open Library search:
// { description, ratingAverage, ratingCount }
async function fetchOpenLibraryWork(workKey) {
  const [work, ratings] = await Promise.all([
    fetch(`https://openlibrary.org${workKey}.json`).then(r => (r.ok ? r.json() : {})).catch(() => ({})),
    fetch(`https://openlibrary.org${workKey}/ratings.json`).then(r => (r.ok ? r.json() : {})).catch(() => ({}))
  ]);
  const description = typeof work.description === 'string' ? work.description : work.description?.value || '';
  return {
    // Open Library descriptions often end with a source/link block
    description: description.split(/\n-{3,}|\(\[source\]/)[0].trim(),
    ratingAverage: ratings.summary?.average ? Math.round(ratings.summary.average * 10) / 10 : null,
    ratingCount: ratings.summary?.count || 0
  };
}

// Strip any HTML the book APIs include in descriptions
const plainText = (text) =>
  (text || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();

// Expanded view of a search result: synopsis, ratings, and how many
// Pagebound readers have it / are reading it together.
// Close keeps the search open; Add to library adds it and closes the search.
function BookPreview({ book, inLibrary, onClose, onAdd }) {
  const [stats, setStats] = useState(null);
  const [work, setWork] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isPreviewMode()) {
      setStats({ inLibraries: 0, activeSessions: 0, ratingCount: 0, ratingAverage: null });
      return undefined;
    }
    let cancelled = false;
    getBookStats(book.isbn)
      .then(data => { if (!cancelled) setStats(data); })
      .catch(() => { if (!cancelled) setStats({ unavailable: true }); });
    return () => { cancelled = true; };
  }, [book.isbn]);

  // Fill in synopsis and outside ratings for Open Library results
  useEffect(() => {
    if (book.description || !book.workKey) return undefined;
    let cancelled = false;
    fetchOpenLibraryWork(book.workKey).then(data => { if (!cancelled) setWork(data); });
    return () => { cancelled = true; };
  }, [book.description, book.workKey]);

  const synopsis = plainText(book.description || work?.description);
  const loadingSynopsis = !book.description && book.workKey && !work;
  const isLong = synopsis.length > SYNOPSIS_PREVIEW_CHARS;
  const shownSynopsis = expanded || !isLong
    ? synopsis
    : `${synopsis.slice(0, SYNOPSIS_PREVIEW_CHARS).replace(/\s+\S*$/, '')}…`;

  const handleAdd = async () => {
    try {
      setAdding(true);
      setError(null);
      await onAdd(book);
    } catch (err) {
      setError(err.message || 'Could not add this book. Please try again.');
      setAdding(false);
    }
  };

  const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal book-preview" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={book.title}>
        <button type="button" className="close-button" onClick={onClose} aria-label="Close">✕</button>

        <div className="book-preview-header">
          <div className="book-preview-cover">
            {book.coverUrl ? <img src={book.coverUrl} alt="" /> : <span aria-hidden="true">📖</span>}
          </div>
          <div className="book-preview-titles">
            <h2>{book.title}</h2>
            <p className="book-preview-author">{book.author}</p>
            <p className="book-preview-meta">
              {[book.publishYear !== 'Unknown' && book.publishYear, book.pageCount && `${book.pageCount} pages`]
                .filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>

        <div className="book-preview-stats" aria-live="polite">
          {!stats ? (
            <span className="book-preview-stat is-loading">Loading reader stats…</span>
          ) : stats.unavailable ? null : (
            <>
              <span className="book-preview-stat">
                <BookOpen size={14} aria-hidden="true" />
                {stats.inLibraries
                  ? `In ${count(stats.inLibraries, 'library', 'libraries')} on Pagebound`
                  : 'Not in any Pagebound library yet'}
              </span>
              <span className="book-preview-stat">
                <Users size={14} aria-hidden="true" />
                {count(stats.activeSessions || 0, 'active session', 'active sessions')}
              </span>
            </>
          )}
        </div>

        <section className="book-preview-section">
          <h3>Reviews</h3>
          {stats?.ratingCount ? (
            <p className="book-preview-rating">
              <span className="book-preview-stars" aria-hidden="true">★</span>
              <strong>{stats.ratingAverage}</strong> from {count(stats.ratingCount, 'Pagebound reader', 'Pagebound readers')}
            </p>
          ) : (
            <p className="book-preview-muted">No Pagebound ratings yet.</p>
          )}
          {book.averageRating ? (
            <p className="book-preview-muted">
              {book.averageRating} on Google Books ({count(book.ratingsCount || 0, 'rating', 'ratings')})
            </p>
          ) : null}
          {work?.ratingAverage ? (
            <p className="book-preview-muted">
              {work.ratingAverage} on Open Library ({count(work.ratingCount, 'rating', 'ratings')})
            </p>
          ) : null}
        </section>

        <section className="book-preview-section">
          <h3>Synopsis</h3>
          {loadingSynopsis ? (
            <p className="book-preview-muted">Loading synopsis…</p>
          ) : synopsis ? (
            <>
              <p className="book-preview-synopsis">{shownSynopsis}</p>
              {isLong && (
                <button type="button" className="link-button" onClick={() => setExpanded(!expanded)}>
                  {expanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </>
          ) : (
            <p className="book-preview-muted">No synopsis available.</p>
          )}
        </section>

        {error && <div className="error-message">{error}</div>}

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
          {inLibrary ? (
            <button type="button" className="btn-primary" disabled>
              In your library
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={handleAdd} disabled={adding}>
              {adding ? 'Adding…' : 'Add to library'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default BookPreview;
