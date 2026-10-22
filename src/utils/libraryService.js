// Library service for managing user's book library
const API_ENDPOINT = process.env.REACT_APP_API_ENDPOINT;

/**
 * Get user's library books
 * @param {string} userId - User's ID
 * @param {string} [shelf] - Optional shelf filter ('Currently Reading', 'Want to Read', 'Read')
 * @returns {Promise<{books: Array, count: number}>}
 */
export const getLibraryBooks = async (userId, shelf = null) => {
  const url = shelf
    ? `${API_ENDPOINT}/library/${userId}/books?shelf=${encodeURIComponent(shelf)}`
    : `${API_ENDPOINT}/library/${userId}/books`;

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch library books');
  }

  return await response.json();
};

/**
 * Add book to user's library
 * @param {string} userId - User's ID
 * @param {Object} book - Book object
 * @param {string} book.isbn - Book ISBN
 * @param {string} book.title - Book title
 * @param {string} book.author - Book author
 * @param {string} [book.coverUrl] - Book cover image URL
 * @param {string} [book.shelf] - Shelf name (default: 'Want to Read')
 * @param {number} [book.currentChapter] - Current chapter
 * @param {number} [book.totalChapters] - Total chapters
 * @param {number} [book.progress] - Reading progress percentage
 * @param {number} [book.rating] - User rating (0-5)
 * @returns {Promise<{success: boolean}>}
 */
export const addBookToLibrary = async (userId, book) => {
  const response = await fetch(`${API_ENDPOINT}/library/${userId}/books`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(book)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to add book to library');
  }

  return await response.json();
};

/**
 * Update book in user's library
 * @param {string} userId - User's ID
 * @param {string} isbn - Book ISBN
 * @param {Object} updates - Updates to apply
 * @param {string} [updates.shelf] - New shelf
 * @param {number} [updates.currentChapter] - Current chapter
 * @param {number} [updates.totalChapters] - Total chapters
 * @param {number} [updates.progress] - Reading progress percentage
 * @param {number} [updates.rating] - User rating
 * @returns {Promise<{success: boolean}>}
 */
export const updateLibraryBook = async (userId, isbn, updates) => {
  const response = await fetch(`${API_ENDPOINT}/library/${userId}/books/${encodeURIComponent(isbn)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update book');
  }

  return await response.json();
};

/**
 * Remove book from user's library
 * @param {string} userId - User's ID
 * @param {string} isbn - Book ISBN
 * @returns {Promise<{success: boolean}>}
 */
export const removeLibraryBook = async (userId, isbn) => {
  const response = await fetch(`${API_ENDPOINT}/library/${userId}/books/${encodeURIComponent(isbn)}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to remove book');
  }

  return await response.json();
};

/**
 * Get library stats
 * @param {string} userId - User's ID
 * @returns {Promise<{totalBooks: number, currentlyReading: number, wantToRead: number, booksRead: number, chaptersCompleted: number}>}
 */
export const getLibraryStats = async (userId) => {
  const response = await fetch(`${API_ENDPOINT}/library/${userId}/stats`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get library stats');
  }

  return await response.json();
};
