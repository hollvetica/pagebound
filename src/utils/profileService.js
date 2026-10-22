// Profile service: your own profile, stats and photo
import { apiJson } from './apiFetch';

const userPath = (email, action) => `/users/${encodeURIComponent(email)}${action ? `/${action}` : ''}`;

// Update your profile: { tagline?, favoriteBooks?, isPrivate? } -> { profile }
export const updateProfile = (email, updates) =>
  apiJson(userPath(email, 'profile'), { method: 'PUT', body: JSON.stringify(updates) });

// { totalBooks, booksRead, currentlyReading, chaptersCompleted, friendsCount, joinedDate }
export const getUserStats = (email) => apiJson(userPath(email, 'stats'));

// Upload a photo prepared by resizeImageToDataUrl -> { avatarUrl }
export const uploadAvatar = (email, imageData) =>
  apiJson(userPath(email, 'avatar'), { method: 'POST', body: JSON.stringify({ imageData }) });

// Centre-crop an image file to a square and shrink it to `size` px (JPEG)
export const resizeImageToDataUrl = (file, size = 400) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      canvas.getContext('2d').drawImage(
        img,
        (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side,
        0, 0, size, size
      );
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file couldn't be read as an image"));
    };
    img.src = url;
  });
