// This device's copy of a reader's library, used to show something while
// offline. The server is always the source of truth: nothing here is ever
// uploaded back.
//
// Each account gets its own key, so a shared phone or laptop never shows (or
// mixes in) someone else's books. Preview and the demo build keep the single
// unkeyed key their sample data lives under.
import { isPreviewMode } from './previewMode';

const PREVIEW_KEY = 'pagebound-library';

const keyFor = (userId) => (isPreviewMode() ? PREVIEW_KEY : userId ? `pagebound-library:${userId}` : null);

export function readLibraryCache(userId) {
  const key = keyFor(userId);
  if (!key) return null;
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

export function writeLibraryCache(userId, books) {
  const key = keyFor(userId);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(books));
  } catch {
    // Storage full or blocked: the cache is only a convenience
  }
}
