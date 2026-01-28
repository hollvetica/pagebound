import React, { useState } from 'react';
import './BookSearch.css';

function BookSearch({ onBookSelect }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);

    try {
      // Try Google Books API first
      const googleResponse = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchQuery)}&maxResults=10`
      );

      if (googleResponse.ok) {
        const data = await googleResponse.json();

        if (data.items && data.items.length > 0) {
          // Transform Google Books data to our format
          const books = data.items.map(item => ({
            isbn: item.volumeInfo.industryIdentifiers?.[0]?.identifier || item.id,
            title: item.volumeInfo.title,
            author: item.volumeInfo.authors?.join(', ') || 'Unknown Author',
            coverUrl: item.volumeInfo.imageLinks?.thumbnail || null,
            publishYear: item.volumeInfo.publishedDate?.substring(0, 4) || 'Unknown',
            description: item.volumeInfo.description || ''
          }));

          setSearchResults(books);
          setIsSearching(false);
          return;
        }
      }

      // Fallback to Open Library API if Google Books fails or returns no results
      console.log('Falling back to Open Library API...');
      const openLibResponse = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(searchQuery)}&limit=10`
      );

      if (!openLibResponse.ok) {
        throw new Error('Search failed');
      }

      const openLibData = await openLibResponse.json();

      if (!openLibData.docs || openLibData.docs.length === 0) {
        setSearchResults([]);
        setError('No books found. Try a different search.');
        setIsSearching(false);
        return;
      }

      // Transform Open Library data to our format
      const books = openLibData.docs.map(doc => ({
        isbn: doc.isbn?.[0] || doc.key,
        title: doc.title,
        author: doc.author_name?.join(', ') || 'Unknown Author',
        coverUrl: doc.cover_i
          ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
          : null,
        publishYear: doc.first_publish_year || 'Unknown',
        description: doc.first_sentence?.join(' ') || ''
      }));

      setSearchResults(books);
      setIsSearching(false);
    } catch (err) {
      console.error('Search error:', err);
      setError('Something went wrong. Please try again.');
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="book-search-inline">
      <div className="search-input-wrapper">
        <input
          type="text"
          placeholder="Add a book by title or ISBN"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          className="search-input"
        />
        <button
          onClick={handleSearch}
          className="search-button"
          disabled={isSearching || !searchQuery.trim()}
          aria-label="Search"
        >
          {isSearching ? '⏳' : '🔍'}
        </button>
      </div>

      {error && <p className="search-error">{error}</p>}

      {searchResults.length > 0 && (
        <div className="search-results">
          <h4>Search Results ({searchResults.length})</h4>
          {searchResults.map((book) => (
            <div key={book.isbn} className="book-result" onClick={() => onBookSelect(book)}>
              <div className="book-cover-placeholder">
                {book.coverUrl ? (
                  <img src={book.coverUrl} alt={book.title} />
                ) : (
                  '📖'
                )}
              </div>
              <div className="book-info">
                <h5>{book.title}</h5>
                <p className="book-author">{book.author}</p>
                <p className="book-year">{book.publishYear}</p>
              </div>
              <button className="add-book-btn">+</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default BookSearch;