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
