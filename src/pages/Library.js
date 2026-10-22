import { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import BookSearch from '../components/BookSearch';
import BookDetail from './BookDetail';
import BookRating from '../components/BookRating';
import { useSession } from '../context/SessionContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getLibraryBooks, addBookToLibrary, updateLibraryBook } from '../utils/libraryService';
import './Library.css';

function Library() {
  const { createSession } = useSession();
  const { currentTheme } = useTheme();
  const { userProfile } = useAuth();

  // Track shelf visibility (public/private)
  const [shelfVisibility, setShelfVisibility] = useState({
    'Currently Reading': true,
    'Want to Read': true,
    'Read': true
  });

  const toggleShelfVisibility = (shelfName) => {
    setShelfVisibility(prev => ({
      ...prev,
      [shelfName]: !prev[shelfName]
    }));
  };
  
  const [myBooks, setMyBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [, setIsLoaded] = useState(false);

  // Load books from backend on mount
  useEffect(() => {
    const loadLibrary = async () => {
      if (userProfile?.userId) {
        try {
          // Try to load from backend first
          const backendBooks = await getLibraryBooks(userProfile.userId);

          if (backendBooks.books && backendBooks.books.length > 0) {
            setMyBooks(backendBooks.books);
            // Sync to localStorage for offline cache
            localStorage.setItem('pagebound-library', JSON.stringify(backendBooks.books));
          } else {
            // Fallback to localStorage if backend is empty (first-time migration)
            const localBooks = localStorage.getItem('pagebound-library');
            if (localBooks) {
              const parsed = JSON.parse(localBooks);
              setMyBooks(parsed);

              // Sync to backend
              await Promise.all(
                parsed.map((book) => addBookToLibrary(userProfile.userId, book))
              );
            }
          }
        } catch (error) {
          console.error('Error loading library:', error);
          // Fallback to localStorage on error
          const localBooks = localStorage.getItem('pagebound-library');
          if (localBooks) {
            setMyBooks(JSON.parse(localBooks));
          }
        } finally {
          setIsLoaded(true);
        }
      } else {
        setIsLoaded(true);
      }
    };
    loadLibrary();
  }, [userProfile]);

  const handleAddBook = async (book) => {
    // Check if book is already in library
    if (myBooks.find(b => b.isbn === book.isbn)) {
      alert('This book is already in your library!');
      return;
    }

    const newBook = {
      ...book,
      shelf: 'Want to Read',
      addedAt: new Date().toISOString(),
      currentChapter: 0,
      totalChapters: 0,
      progress: 0,
      rating: 0,
      friendsReading: 0,
      hasMessage: false
    };

    // Add book to local state
    setMyBooks([...myBooks, newBook]);

    // Sync to backend and localStorage
    if (userProfile?.userId) {
      try {
        await addBookToLibrary(userProfile.userId, newBook);
      } catch (error) {
        console.error('Error adding book to backend:', error);
      }
    }
    localStorage.setItem('pagebound-library', JSON.stringify([...myBooks, newBook]));
  };

  const handleBookClick = (book) => {
    setSelectedBook(book);
  };

  const handleCloseDetail = () => {
    setSelectedBook(null);
  };

  // BookDetail builds the session (tracking mode, totals, invited friends).
  // Errors (e.g. a session already exists for this book) are shown in the sheet.
  const handleStartSession = async (sessionData) => {
    await createSession(sessionData);
  };

  const handleUpdateBook = async (updatedBook) => {
    const newBooks = myBooks.map((book) =>
      book.isbn === updatedBook.isbn ? updatedBook : book
    );

    setMyBooks(newBooks);

    // Sync to backend and localStorage
    if (userProfile?.userId) {
      try {
        await updateLibraryBook(userProfile.userId, updatedBook.isbn, updatedBook);
      } catch (error) {
        console.error('Error updating book in backend:', error);
      }
    }
    localStorage.setItem('pagebound-library', JSON.stringify(newBooks));
  };

  const handleRatingChange = async (isbn, newRating) => {
    const book = myBooks.find((b) => b.isbn === isbn);
    if (book) {
      await handleUpdateBook({ ...book, rating: newRating });
    }
  };

  const groupedBooks = myBooks.reduce((acc, book) => {
    if (!acc[book.shelf]) {
      acc[book.shelf] = [];
    }
    acc[book.shelf].push(book);
    return acc;
  }, {});

  return (
    <div className="page library-page">
      <div className="library-header">
        <h2>My Library</h2>
        <p>{myBooks.length} books</p>
      </div>

      <BookSearch onBookSelect={handleAddBook} />

      <div className="library-shelves">
        {Object.keys(groupedBooks).map((shelfName) => (
          <div key={shelfName} className="shelf-section">
            <div className="shelf-header">
              <h3>{shelfName}</h3>
              <button
                className="shelf-visibility-toggle"
                onClick={() => toggleShelfVisibility(shelfName)}
                title={shelfVisibility[shelfName] ? 'Make Private' : 'Make Public'}
              >
                {shelfVisibility[shelfName] ? (
                  <>
                    <Eye size={16} /> Public
                  </>
                ) : (
                  <>
                    <EyeOff size={16} /> Private
                  </>
                )}
              </button>
            </div>
            <div className="books-grid">
              {groupedBooks[shelfName].map((book) => (
                <div
                  key={book.isbn}
                  className="book-card"
                  onClick={() => handleBookClick(book)}
                >
                  <div className="book-card-cover">
                    {book.coverUrl ? (
                      <img src={book.coverUrl} alt={book.title} />
                    ) : (
                      '📚'
                    )}
                    {/* Indicators overlay */}
                    <div className="book-indicators">
                      {book.friendsReading > 0 && (
                        <span className="friend-indicator" title={`${book.friendsReading} friends reading`}>
                          👥 {book.friendsReading}
                        </span>
                      )}
                      {book.hasMessage && (
                        <span className="message-indicator" title="New message">
                          💬
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Progress bar for Currently Reading */}
                  {book.shelf === 'Currently Reading' && book.progress !== undefined && (
                    <div className="book-progress-bar">
                      <div
                        className="book-progress-fill"
                        style={{ width: `${book.progress}%` }}
                      />
                    </div>
                  )}
                  <div className="book-card-info">
                    <h4>{book.title}</h4>
                    <p>{book.author}</p>
                    {/* Rating */}
                    <div className="book-card-rating" onClick={(e) => e.stopPropagation()}>
                      <BookRating
                        rating={book.rating || 0}
                        onRatingChange={(rating) => handleRatingChange(book.isbn, rating)}
                        theme={currentTheme}
                        size="small"
                        interactive={true}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {myBooks.length === 0 && (
        <div className="empty-library">
          <p>Your library is empty</p>
          <p>Add your first book to get started!</p>
        </div>
      )}

      {selectedBook && (
        <BookDetail 
          book={selectedBook}
          onClose={handleCloseDetail}
          onStartSession={handleStartSession}
          onUpdateBook={handleUpdateBook}
        />
      )}

    </div>
  );
}

export default Library;
