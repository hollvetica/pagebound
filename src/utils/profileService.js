// Profile service for managing user profile operations
const API_ENDPOINT = process.env.REACT_APP_API_ENDPOINT;

/**
 * Get presigned URL for avatar upload
 * @param {string} email - User's email
 * @param {string} fileType - MIME type of the file (e.g., 'image/jpeg')
 * @returns {Promise<{uploadUrl: string, imageUrl: string, expiresIn: number}>}
 */
export const getAvatarUploadUrl = async (email, fileType) => {
  const response = await fetch(`${API_ENDPOINT}/users/${encodeURIComponent(email)}/avatar-upload-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fileType })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get upload URL');
  }

  return await response.json();
};

/**
 * Upload image to S3 using presigned URL
 * @param {string} presignedUrl - Presigned S3 URL
 * @param {File} file - Image file to upload
 * @returns {Promise<void>}
 */
export const uploadAvatarToS3 = async (presignedUrl, file) => {
  const response = await fetch(presignedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type
    },
    body: file
  });

  if (!response.ok) {
    throw new Error('Failed to upload image to S3');
  }
};

/**
 * Confirm avatar upload and update database
 * @param {string} email - User's email
 * @param {string} imageUrl - URL of the uploaded image
 * @returns {Promise<{success: boolean, avatarUrl: string}>}
 */
export const confirmAvatarUpload = async (email, imageUrl) => {
  const response = await fetch(`${API_ENDPOINT}/users/${encodeURIComponent(email)}/avatar-confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ imageUrl })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to confirm avatar upload');
  }

  return await response.json();
};

/**
 * Update user profile (tagline, favoriteBooks, bio)
 * @param {string} email - User's email
 * @param {Object} updates - Profile updates
 * @param {string} [updates.tagline] - Personal tagline (max 255 chars)
 * @param {Array} [updates.favoriteBooks] - Array of favorite book objects (max 10)
 * @param {string} [updates.bio] - User bio
 * @returns {Promise<{success: boolean}>}
 */
export const updateProfile = async (email, updates) => {
  const response = await fetch(`${API_ENDPOINT}/users/${encodeURIComponent(email)}/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update profile');
  }

  return await response.json();
};

/**
 * Get user reading stats
 * @param {string} email - User's email
 * @returns {Promise<{chaptersCompleted: number, booksRead: number, totalBooks: number, joinedDate: string}>}
 */
export const getUserStats = async (email) => {
  const response = await fetch(`${API_ENDPOINT}/users/${encodeURIComponent(email)}/stats`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get user stats');
  }

  return await response.json();
};
