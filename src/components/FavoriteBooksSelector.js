import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getLibraryBooks } from '../utils/libraryService';
import { readLibraryCache } from '../utils/libraryCache';
import './FavoriteBooksSelector.css';

function FavoriteBooksSelector({ currentSelection, onSave, onCancel }) {
  const { userProfile } = useAuth();
  const [libraryBooks, setLibraryBooks] = useState([]);
  const [selected, setSelected] = useState(currentSelection || []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadLibrary = async () => {
      try {
        if (userProfile?.userId) {
          // Try to load from backend
          const response = await getLibraryBooks(userProfile.userId);
          setLibraryBooks(response.books || []);
        }
      } catch (err) {
        console.error('Error loading library:', err);
        // Fall back to this account's copy on this device
        const cached = readLibraryCache(userProfile?.userId);
        if (cached) {
          setLibraryBooks(cached);
        } else {
          setError('Failed to load your library');
        }
      } finally {
        setLoading(false);
      }
    };
    loadLibrary();
  }, [userProfile]);

  const toggleBook = (book) => {
    const isSelected = selected.find((b) => b.isbn === book.isbn);
    if (isSelected) {
      setSelected(selected.filter((b) => b.isbn !== book.isbn));
    } else {
      if (selected.length >= 10) {
        alert('You can only select up to 10 books');
        return;
      }
      setSelected([
        ...selected,
        {
          isbn: book.isbn,
          title: book.title,
          author: book.author,
          coverUrl: book.coverUrl
        }
      ]);
    }
  };

  if (loading) {
    return <p className="loading-message">Loading your library...</p>;
  }

  if (error) {
    return <p className="error-message">{error}</p>;
  }

  if (libraryBooks.length === 0) {
    return (
      <div className="favorites-selector">
        <p className="empty-library-message">
          Add books to your library first to select favorites!
        </p>
        <button onClick={onCancel} className="cancel-button">
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="favorites-selector">
      <p className="selection-count">
        {selected.length}/10 selected
      </p>
      <div className="books-selection-grid">
        {libraryBooks.map((book) => {
          const isSelected = selected.find((b) => b.isbn === book.isbn);
          return (
            <div
              key={book.isbn}
              className={`selectable-book ${isSelected ? 'selected' : ''}`}
              onClick={() => toggleBook(book)}
            >
              {book.coverUrl ? (
                <img src={book.coverUrl} alt={book.title} />
              ) : (
                <div className="book-placeholder">📚</div>
              )}
              <p className="book-title">{book.title}</p>
              {isSelected && <span className="check-mark">✓</span>}
            </div>
          );
        })}
      </div>
      <div className="selector-actions">
        <button onClick={() => onSave(selected)} className="save-button">
          Save Selection
        </button>
        <button onClick={onCancel} className="cancel-button">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default FavoriteBooksSelector;
