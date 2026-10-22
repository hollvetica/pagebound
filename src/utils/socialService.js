// Social service: Home feed, reactions and recommendations
import { apiJson } from './apiFetch';

// { items: [...], reactionSet: ['❤️', ...] }
export const getFeed = () => apiJson('/feed');

// Set, change, or clear (emoji: null) your reaction to a feed item
export const setReaction = (itemId, emoji) =>
  apiJson(`/feed/items/${encodeURIComponent(itemId)}/reactions`, {
    method: 'PUT',
    body: JSON.stringify({ emoji })
  });

// Recommend a book ({ isbn, title, author, coverUrl }) to friends
export const recommendBook = (toUserIds, book, note) =>
  apiJson('/recommendations', {
    method: 'POST',
    body: JSON.stringify({ toUserIds, book, note })
  });

// ---------------------------------------------------------------- reviews
// { reviews: [...], mine, count, average }
export const getBookReviews = (isbn) => apiJson(`/books/${encodeURIComponent(isbn)}/reviews`);

// Save your review: rating 1-5, text, book { title, author, coverUrl }
export const saveReview = (isbn, { rating, text, book }) =>
  apiJson(`/books/${encodeURIComponent(isbn)}/reviews/mine`, {
    method: 'PUT',
    body: JSON.stringify({ rating, text, book })
  });

export const deleteReview = (isbn) =>
  apiJson(`/books/${encodeURIComponent(isbn)}/reviews/mine`, { method: 'DELETE' });

// A reader's reviews (yourself, or a friend) -> { isPrivate, reviews }
export const getUserReviews = (userId) => apiJson(`/reviews/by/${encodeURIComponent(userId)}`);
