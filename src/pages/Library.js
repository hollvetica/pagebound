import { useState, useEffect } from 'react';
import { Eye, EyeOff, Pencil, Plus } from 'lucide-react';
import BookSearch from '../components/BookSearch';
import BookCard from '../components/BookCard';
import ShelfEditor from '../components/ShelfEditor';
import BookDetail from './BookDetail';
import { useSession } from '../context/SessionContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import {
  getLibraryBooks, addBookToLibrary, updateLibraryBook,
  getShelves, createShelf, updateShelf, deleteShelf
} from '../utils/libraryService';
import { STATUS_SHELVES, booksOnShelf } from '../utils/shelves';
import { isPreviewMode } from '../utils/previewMode';
import { readLibraryCache, writeLibraryCache } from '../utils/libraryCache';
import './Library.css';

const PREVIEW_SHELVES_KEY = 'pagebound-shelves';

function Library({ onNavigate }) {
  const { createSession, getSessionForBook } = useSession();
  const { currentTheme } = useTheme();
  const { userProfile } = useAuth();
  const userId = userProfile?.userId;
  const preview = isPreviewMode();

  const [myBooks, setMyBooks] = useState([]);
  const [shelves, setShelves] = useState(STATUS_SHELVES);
  const [selectedBook, setSelectedBook] = useState(null);
  const [editingShelf, setEditingShelf] = useState(null); // shelf object, 'new', or null
  const [libraryError, setLibraryError] = useState(null);

  // ---- Load books --------------------------------------------------------
  useEffect(() => {
    const loadLibrary = async () => {
      if (!userId) return;
      // The server's copy always wins. This device's copy (per account) is only
      // shown when the server can't be reached, and is never uploaded back.
      try {
        const backendBooks = await getLibraryBooks(userId);
        const books = backendBooks.books || [];
        setMyBooks(books);
        writeLibraryCache(userId, books);
        setLibraryError(null);
      } catch (error) {
        console.error('Error loading library:', error);
        const cached = readLibraryCache(userId);
        if (cached) setMyBooks(cached);
        if (!preview) {
          setLibraryError(cached
            ? "Couldn't reach Pagebound, so this is the copy saved on this device. Changes may not save until you're back online."
            : "Couldn't load your library. Check your connection and try again.");
        }
      }
    };
    loadLibrary();
  }, [userId, preview]);

  // ---- Load shelves ------------------------------------------------------
  useEffect(() => {
    if (preview) {
      const saved = localStorage.getItem(PREVIEW_SHELVES_KEY);
      setShelves(saved ? JSON.parse(saved) : STATUS_SHELVES);
      return;
    }
    if (!userId) return;
    getShelves(userId)
      .then(data => setShelves(data.shelves?.length ? data.shelves : STATUS_SHELVES))
      .catch(error => console.error('Error loading shelves:', error));
  }, [preview, userId]);

  const saveShelves = (next) => {
    setShelves(next);
    if (preview) localStorage.setItem(PREVIEW_SHELVES_KEY, JSON.stringify(next));
  };

  // ---- Books -------------------------------------------------------------
  const persistBooks = (books) => {
    setMyBooks(books);
    writeLibraryCache(userId, books);
  };

  // Saves show right away; if the server says no, they're undone and the
  // reader is told, so nothing looks saved that isn't.
  const undo = (change) => setMyBooks(prev => {
    const next = change(prev);
    writeLibraryCache(userId, next);
    return next;
  });

  // Called from search; resolves to false if the book couldn't be saved
  const handleAddBook = async (book) => {
    if (myBooks.find(b => b.isbn === book.isbn)) return true;

    const newBook = {
      ...book,
      shelf: 'Want to Read',
      shelves: [],
      addedAt: new Date().toISOString(),
      currentChapter: 0,
      totalChapters: 0,
      totalPages: book.pageCount || 0,
      progress: 0,
      rating: 0
    };

    persistBooks([...myBooks, newBook]);
    if (preview) return true;
    try {
      setLibraryError(null);
      await addBookToLibrary(userId, newBook);
      return true;
    } catch (error) {
      console.error('Error adding book to backend:', error);
      if (error.status === 409) return true; // already in the library
      undo(books => books.filter(b => b.isbn !== newBook.isbn));
      setLibraryError(`Couldn't add “${book.title}”. Check your connection and try again.`);
      return false;
    }
  };

  const handleUpdateBook = async (updatedBook) => {
    const previous = myBooks.find(b => b.isbn === updatedBook.isbn);
    persistBooks(myBooks.map((book) => (book.isbn === updatedBook.isbn ? updatedBook : book)));
    if (preview) return;
    try {
      setLibraryError(null);
      await updateLibraryBook(userId, updatedBook.isbn, updatedBook);
    } catch (error) {
      console.error('Error updating book in backend:', error);
      if (previous) undo(books => books.map(b => (b.isbn === previous.isbn ? previous : b)));
      setLibraryError(`Couldn't save your changes to “${updatedBook.title}”, so they've been undone. Check your connection and try again.`);
    }
  };

  const handleRatingChange = async (isbn, newRating) => {
    const book = myBooks.find((b) => b.isbn === isbn);
    if (book) await handleUpdateBook({ ...book, rating: newRating });
  };

  // BookDetail builds the session (tracking mode, totals, invited friends).
  // Errors (e.g. a session already exists for this book) are shown in the sheet.
  const handleStartSession = async (sessionData) => {
    await createSession(sessionData);
  };

  // ---- Shelves -----------------------------------------------------------
  const handleToggleVisibility = async (shelf) => {
    const visibility = shelf.visibility === 'private' ? 'public' : 'private';
    const previous = shelves;
    saveShelves(shelves.map(s => (s.shelfId === shelf.shelfId ? { ...s, visibility } : s)));
    if (preview) return;
    try {
      setLibraryError(null);
      await updateShelf(userId, shelf.shelfId, { visibility });
    } catch (error) {
      setShelves(previous);
      setLibraryError(`Couldn't update “${shelf.name}”. Please try again.`);
    }
  };

  const handleSaveShelf = async ({ name, visibility }) => {
    if (editingShelf === 'new') {
      const shelf = preview
        ? { shelfId: `shelf-${Date.now()}`, kind: 'custom', name, visibility }
        : (await createShelf(userId, { name, visibility })).shelf;
      saveShelves([...shelves, shelf]);
    } else {
      const shelf = preview
        ? { ...editingShelf, name, visibility }
        : (await updateShelf(userId, editingShelf.shelfId, { name, visibility })).shelf;
      saveShelves(shelves.map(s => (s.shelfId === shelf.shelfId ? shelf : s)));
    }
  };

  const handleDeleteShelf = async () => {
    const shelfId = editingShelf.shelfId;
    if (!preview) await deleteShelf(userId, shelfId);
    saveShelves(shelves.filter(s => s.shelfId !== shelfId));
    persistBooks(myBooks.map(b => ({ ...b, shelves: (b.shelves || []).filter(id => id !== shelfId) })));
  };

  const customShelves = shelves.filter(s => s.kind === 'custom');
  // Status shelves show when they have books; custom shelves always show
  const visibleShelves = shelves.filter(s => s.kind === 'custom' || booksOnShelf(myBooks, s).length > 0);
  const libraryIsbns = new Set(myBooks.map(b => b.isbn));

  return (
    <div className="page library-page">
      <div className="library-header">
        <h2>My Library</h2>
        <p>{myBooks.length} book{myBooks.length !== 1 ? 's' : ''}</p>
      </div>

      <BookSearch onAddBook={handleAddBook} libraryIsbns={libraryIsbns} />

      <div className="library-toolbar">
        <span className="overline">Shelves</span>
        <button className="btn-secondary btn-sm" onClick={() => setEditingShelf('new')}>
          <Plus size={14} /> New shelf
        </button>
      </div>

      {libraryError && <div className="error-message library-shelf-error" role="alert">{libraryError}</div>}

      <div className="library-shelves">
        {visibleShelves.map((shelf) => {
          const books = booksOnShelf(myBooks, shelf);
          const isPrivate = shelf.visibility === 'private';
          return (
            <section key={shelf.shelfId} className="shelf-section">
              <div className="shelf-header">
                <h3>
                  {shelf.name}
                  {shelf.kind === 'custom' && <span className="shelf-count">{books.length}</span>}
                </h3>
                <div className="shelf-actions">
                  <button
                    className={`shelf-visibility-toggle ${isPrivate ? 'is-private' : ''}`}
                    onClick={() => handleToggleVisibility(shelf)}
                    title={isPrivate ? 'Only you can see this shelf. Make public?' : 'Friends can see this shelf. Make private?'}
                  >
                    {isPrivate ? <><EyeOff size={14} /> Private</> : <><Eye size={14} /> Public</>}
                  </button>
                  {shelf.kind === 'custom' && (
                    <button className="icon-btn" onClick={() => setEditingShelf(shelf)} aria-label={`Edit ${shelf.name}`}>
                      <Pencil size={14} />
                    </button>
                  )}
                </div>
              </div>

              {books.length > 0 ? (
                <div className="books-grid">
                  {books.map((book) => (
                    <BookCard
                      key={book.isbn}
                      book={book}
                      session={getSessionForBook(book.isbn)}
                      theme={currentTheme}
                      onOpen={setSelectedBook}
                      onRatingChange={handleRatingChange}
                    />
                  ))}
                </div>
              ) : (
                <p className="shelf-empty">
                  Add books to this shelf from a book's details.
                </p>
              )}
            </section>
          );
        })}
      </div>

      {myBooks.length === 0 && (
        <div className="empty-library">
          <p>Your library is empty</p>
          <p>Search for a book above to add your first one.</p>
        </div>
      )}

      {selectedBook && (
        <BookDetail
          book={selectedBook}
          customShelves={customShelves}
          onClose={() => setSelectedBook(null)}
          onStartSession={handleStartSession}
          onUpdateBook={handleUpdateBook}
          onOpenSession={() => {
            setSelectedBook(null);
            onNavigate && onNavigate('sessions');
          }}
        />
      )}

      {editingShelf && (
        <ShelfEditor
          shelf={editingShelf === 'new' ? null : editingShelf}
          onSave={handleSaveShelf}
          onDelete={editingShelf === 'new' ? null : handleDeleteShelf}
          onClose={() => setEditingShelf(null)}
        />
      )}
    </div>
  );
}

export default Library;
