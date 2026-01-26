import React, { useState } from 'react';
import './UpdateProgress.css';

function UpdateProgress({ session, onClose, onUpdateProgress }) {
  const userParticipant = session.participants.find(p => p.isHost);
  const [trackingMode, setTrackingMode] = useState(session.trackingMode || 'chapters'); // 'chapters' or 'pages'
  const [currentChapter, setCurrentChapter] = useState(userParticipant?.currentChapter || 0);
  const [currentPage, setCurrentPage] = useState(userParticipant?.currentPage || 0);

  const handleUpdate = () => {
    if (trackingMode === 'chapters') {
      if (currentChapter < 0 || currentChapter > session.totalChapters) {
        alert(`Please enter a chapter between 0 and ${session.totalChapters}`);
        return;
      }
      onUpdateProgress(session.id, 'You', currentChapter, currentPage, trackingMode);
    } else {
      if (currentPage < 0 || currentPage > session.totalPages) {
        alert(`Please enter a page between 0 and ${session.totalPages}`);
        return;
      }
      onUpdateProgress(session.id, 'You', currentChapter, currentPage, trackingMode);
    }
    onClose();
  };

  const getCurrentValue = () => trackingMode === 'chapters' ? currentChapter : currentPage;
  const getTotalValue = () => trackingMode === 'chapters' ? session.totalChapters : session.totalPages;
  const getLabel = () => trackingMode === 'chapters' ? 'Chapter' : 'Page';
  
  const progressPercent = getTotalValue() 
    ? Math.round((getCurrentValue() / getTotalValue()) * 100)
    : 0;

  const handleIncrement = () => {
    if (trackingMode === 'chapters') {
      setCurrentChapter(Math.min(session.totalChapters, currentChapter + 1));
    } else {
      setCurrentPage(Math.min(session.totalPages, currentPage + 1));
    }
  };

  const handleDecrement = () => {
    if (trackingMode === 'chapters') {
      setCurrentChapter(Math.max(0, currentChapter - 1));
    } else {
      setCurrentPage(Math.max(0, currentPage - 1));
    }
  };

  const handleInputChange = (value) => {
    if (trackingMode === 'chapters') {
      setCurrentChapter(parseInt(value) || 0);
    } else {
      setCurrentPage(parseInt(value) || 0);
    }
  };

  const handleQuickJump = (position) => {
    const total = getTotalValue();
    if (trackingMode === 'chapters') {
      if (position === 'start') setCurrentChapter(0);
      else if (position === 'halfway') setCurrentChapter(Math.floor(total / 2));
      else if (position === 'finished') setCurrentChapter(total);
    } else {
      if (position === 'start') setCurrentPage(0);
      else if (position === 'halfway') setCurrentPage(Math.floor(total / 2));
      else if (position === 'finished') setCurrentPage(total);
    }
  };

  return (
    <div className="update-progress-overlay" onClick={onClose}>
      <div className="update-progress-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>✕</button>
        
        <h2>Update Your Progress</h2>
        
        <div className="progress-book-info">
          <div className="progress-book-cover">
            {session.bookCover ? (
              <img src={session.bookCover} alt={session.bookTitle} />
            ) : (
              <div className="cover-placeholder">📚</div>
            )}
          </div>
          <div>
            <h3>{session.bookTitle}</h3>
            <p>{session.bookAuthor}</p>
            <p className="total-chapters">
              {session.totalChapters && `${session.totalChapters} chapters`}
              {session.totalChapters && session.totalPages && ' · '}
              {session.totalPages && `${session.totalPages} pages`}
            </p>
          </div>
        </div>

        {/* Tracking Mode Toggle */}
        <div className="tracking-mode-toggle">
          <button 
            className={`mode-btn ${trackingMode === 'chapters' ? 'active' : ''}`}
            onClick={() => setTrackingMode('chapters')}
            disabled={!session.totalChapters}
          >
            By Chapter
          </button>
          <button 
            className={`mode-btn ${trackingMode === 'pages' ? 'active' : ''}`}
            onClick={() => setTrackingMode('pages')}
            disabled={!session.totalPages}
          >
            By Page
          </button>
        </div>

        <div className="progress-input-section">
          <label>What {getLabel().toLowerCase()} are you on?</label>
          <div className="chapter-input-group">
            <button 
              className="chapter-btn"
              onClick={handleDecrement}
              disabled={getCurrentValue() === 0}
            >
              -
            </button>
            <input
              type="number"
              min="0"
              max={getTotalValue()}
              value={getCurrentValue()}
              onChange={(e) => handleInputChange(e.target.value)}
              className="chapter-number-input"
            />
            <button 
              className="chapter-btn"
              onClick={handleIncrement}
              disabled={getCurrentValue() === getTotalValue()}
            >
              +
            </button>
          </div>
          <p className="chapter-label">
            {getLabel()} {getCurrentValue()} of {getTotalValue()}
          </p>
        </div>

        <div className="visual-progress">
          <div className="progress-bar-container">
            <div 
              className="progress-bar-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="progress-percentage">{progressPercent}% complete</p>
        </div>

        <div className="quick-jump-section">
          <p className="quick-jump-label">Quick Jump:</p>
          <div className="quick-jump-buttons">
            <button 
              className="quick-jump-btn"
              onClick={() => handleQuickJump('start')}
            >
              Start
            </button>
            <button 
              className="quick-jump-btn"
              onClick={() => handleQuickJump('halfway')}
            >
              Halfway
            </button>
            <button 
              className="quick-jump-btn"
              onClick={() => handleQuickJump('finished')}
            >
              Finished
            </button>
          </div>
        </div>

        <div className="progress-actions">
          <button className="cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="save-btn" onClick={handleUpdate}>
            💾 Save Progress
          </button>
        </div>
      </div>
    </div>
  );
}

export default UpdateProgress;
