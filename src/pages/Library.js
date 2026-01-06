import React, { useState } from 'react';
import BookSearch from '../components/BookSearch';
import BookDetail from './BookDetail';
import './Library.css';

function Library() {
  const [myBooks, setMyBooks] = useState([
    // Mock books already in library
    {
      isbn: '9780385537858',
      title: 'The Night Circus',
      author: 'Erin Morgenstern',
      coverUrl: null,
      shelf: 'Currently Reading',
      currentChapter: 5
    },
    {
      isbn: '9780525559474',
      title: 'Mexican Gothic',
      author: 'Silvia Moreno-Garcia',
      coverUrl: null,
      shelf: 'Want to Read'
    }
  ]);

  const [showSearch, setShowSearch] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);

  const handleAddBook = (book) => {
    // Check if book is already in library
    if (myBooks.find(b => b.isbn === book.isbn)) {
      alert('This book is already in your library!');
      return;
    }

    // Add book to library with default shelf
    setMyBooks([...myBooks, { ...book, shelf: 'Want to Read' }]);
    setShowSearch(false);
  };

  const handleBookClick = (book) => {
    setSelectedBook(book);
  };

  const handleCloseDetail = () => {
    setSelectedBook(null);
  };

  const handleStartSession = (book) => {
    console.log('Starting session for:', book.title);
    // We'll build this feature next
    alert('Reading session feature coming soon!');
  };

  const handleUpdateBook = (updatedBook) => {
  setMyBooks(myBooks.map(book => 
    book.isbn === updatedBook.isbn ? updatedBook : book
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

      <button 
        className="add-book-toggle"
        onClick={() => setShowSearch(!showSearch)}
      >
        {showSearch ? '✕ Cancel' : '+ Add Book'}
      </button>

      {showSearch && <BookSearch onBookSelect={handleAddBook} />}

      <div className="library-shelves">
        {Object.keys(groupedBooks).map((shelfName) => (
          <div key={shelfName} className="shelf-section">
            <h3>{shelfName}</h3>
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
                  </div>
                  <div className="book-card-info">
                    <h4>{book.title}</h4>
                    <p>{book.author}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {myBooks.length === 0 && !showSearch && (
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