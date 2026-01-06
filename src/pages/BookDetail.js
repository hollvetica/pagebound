import React, { useState } from 'react';
import './BookDetail.css';

function BookDetail({ book, onClose, onStartSession, onUpdateBook }) {
  const [selectedShelf, setSelectedShelf] = useState(book.shelf || 'Want to Read');
  const [totalChapters, setTotalChapters] = useState(book.totalChapters || '');
  const [currentChapter, setCurrentChapter] = useState(book.currentChapter || 0);
  
  const shelves = ['Want to Read', 'Currently Reading', 'Finished'];

  const handleSave = () => {
    const updatedBook = {
      ...book,
      shelf: selectedShelf,
      totalChapters: totalChapters ? parseInt(totalChapters) : null,
      currentChapter: selectedShelf === 'Currently Reading' ? currentChapter : 0
    };
    
    if (onUpdateBook) {
      onUpdateBook(updatedBook);
    }
    
    onClose();
  };

  return (
    <div className="book-detail-overlay" onClick={onClose}>
      <div className="book-detail-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>✕</button>
        
        <div className="book-detail-header">
          <div className="book-detail-cover">
            {book.coverUrl ? (
              <img src={book.coverUrl} alt={book.title} />
            ) : (
              <div className="cover-placeholder">📚</div>
            )}
          </div>
          
          <div className="book-detail-info">
            <h2>{book.title}</h2>
            <p className="book-detail-author">{book.author}</p>
            {book.publishYear && (
              <p className="book-detail-year">Published: {book.publishYear}</p>
            )}
          </div>
        </div>

        {book.description && (
          <div className="book-description">
            <h3>Description</h3>
            <p>{book.description.substring(0, 300)}...</p>
          </div>
        )}

        <div className="book-shelf-selector">
          <h3>Add to Shelf</h3>
          <div className="shelf-buttons">
            {shelves.map((shelf) => (
              <button
                key={shelf}
                className={`shelf-button ${selectedShelf === shelf ? 'active' : ''}`}
                onClick={() => setSelectedShelf(shelf)}
              >
                {shelf}
              </button>
            ))}
          </div>
        </div>

        {(selectedShelf === 'Currently Reading' || selectedShelf === 'Finished') && (
          <div className="chapter-input-section">
            <h3>Book Details</h3>
            <div className="input-group">
              <label>Total Chapters:</label>
              <input
                type="number"
                min="1"
                placeholder="e.g., 24"
                value={totalChapters}
                onChange={(e) => setTotalChapters(e.target.value)}
                className="chapter-input"
              />
            </div>
            
            {selectedShelf === 'Currently Reading' && totalChapters && (
              <div className="input-group">
                <label>Current Chapter:</label>
                <input
                  type="number"
                  min="0"
                  max={totalChapters}
                  placeholder="0"
                  value={currentChapter}
                  onChange={(e) => setCurrentChapter(parseInt(e.target.value) || 0)}
                  className="chapter-input"
                />
              </div>
            )}
          </div>
        )}

        {selectedShelf === 'Currently Reading' && totalChapters && currentChapter > 0 && (
          <div className="reading-progress">
            <h3>Reading Progress</h3>
            <p>Chapter {currentChapter} of {totalChapters}</p>
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${(currentChapter / totalChapters) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        <div className="book-actions">
          <button className="primary-button" onClick={handleSave}>
            💾 Save Changes
          </button>
          <button className="secondary-button" onClick={() => onStartSession(book)}>
            📖 Start Reading Session
          </button>
        </div>
      </div>
    </div>
  );
}

export default BookDetail;