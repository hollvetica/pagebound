import React, { useState, useEffect } from 'react';
import { themes } from '../themes';
import './BookRating.css';

function BookRating({ rating = 0, onRatingChange, theme, size = 'medium', interactive = true }) {
  const [hoverRating, setHoverRating] = useState(0);
  const [currentRating, setCurrentRating] = useState(rating);

  useEffect(() => {
    setCurrentRating(rating);
  }, [rating]);

  const themeData = themes[theme] || themes.fantasy;
  const ratingIcon = themeData.ratingIcon || '⭐';

  const handleClick = (value) => {
    if (!interactive) return;
    setCurrentRating(value);
    if (onRatingChange) {
      onRatingChange(value);
    }
  };

  const handleMouseEnter = (value) => {
    if (!interactive) return;
    setHoverRating(value);
  };

  const handleMouseLeave = () => {
    if (!interactive) return;
    setHoverRating(0);
  };

  const displayRating = hoverRating || currentRating;

  return (
    <div className={`book-rating ${size} ${interactive ? 'interactive' : 'static'}`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <span
          key={value}
          className={`rating-icon ${value <= displayRating ? 'filled' : 'empty'}`}
          onClick={() => handleClick(value)}
          onMouseEnter={() => handleMouseEnter(value)}
          onMouseLeave={handleMouseLeave}
          aria-label={`Rate ${value} out of 5`}
          role={interactive ? 'button' : 'img'}
        >
          {ratingIcon}
        </span>
      ))}
    </div>
  );
}

export default BookRating;
