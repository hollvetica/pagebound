import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import BookSearch from '../components/BookSearch';
import BookDetail from './BookDetail';
import CreateSession from '../components/CreateSession';
import BookRating from '../components/BookRating';
import { useSession } from '../context/SessionContext';
import { useTheme } from '../context/ThemeContext';
import './Library.css';

function Library() {
  const { createSession } = useSession();
  const { currentTheme } = useTheme();

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
  
  const [myBooks, setMyBooks] = useState([
    // Mock books already in library
    {
      isbn: '9780385537858',
      title: 'The Night Circus',
      author: 'Erin Morgenstern',
      coverUrl: null,
      shelf: 'Currently Reading',
      currentChapter: 5,
      totalChapters: 15,
      progress: 33, // percentage
      friendsReading: 3,
      hasMessage: true,
      rating: 0
    },
    {
      isbn: '9780525559474',
      title: 'Mexican Gothic',
      author: 'Silvia Moreno-Garcia',
      coverUrl: null,
      shelf: 'Want to Read',
      totalChapters: 12,
      friendsReading: 1,
      hasMessage: false,
      rating: 0
    }
  ]);

  const [selectedBook, setSelectedBook] = useState(null);
  const [showCreateSession, setShowCreateSession] = useState(false);

  const handleAddBook = (book) => {
    // Check if book is already in library
    if (myBooks.find(b => b.isbn === book.isbn)) {
      alert('This book is already in your library!');
      return;
    }

    // Add book to library with default shelf
    setMyBooks([...myBooks, { ...book, shelf: 'Want to Read' }]);
  };

  const handleBookClick = (book) => {
    setSelectedBook(book);
  };

  const handleCloseDetail = () => {
    setSelectedBook(null);
  };

  const handleStartSession = (book) => {
    setSelectedBook(null);
    setShowCreateSession(true);
  };

  const handleCreateSession = (sessionData) => {
    createSession(sessionData);
    alert('Reading session created! Check your home page.');
  };

  const handleUpdateBook = (updatedBook) => {
    setMyBooks(myBooks.map(book =>
      book.isbn === updatedBook.isbn ? updatedBook : book
    ));
  };

  const handleRatingChange = (isbn, newRating) => {
    setMyBooks(myBooks.map(book =>
      book.isbn === isbn ? { ...book, rating: newRating } : book
    ));
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

      {showCreateSession && selectedBook && (
        <CreateSession
          book={selectedBook}
          onClose={() => setShowCreateSession(false)}
          onCreateSession={handleCreateSession}
        />
      )}
    </div>
  );
}

export default Library;
