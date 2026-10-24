// Library data safety: the server is the source of truth, this device's copy
// is per account and never uploaded, and failed saves are undone visibly.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import Library from './Library';
import * as libraryService from '../utils/libraryService';

jest.mock('../utils/libraryService', () => ({
  getLibraryBooks: jest.fn(),
  addBookToLibrary: jest.fn(),
  updateLibraryBook: jest.fn(),
  getShelves: jest.fn(() => Promise.resolve({ shelves: [] })),
  createShelf: jest.fn(),
  updateShelf: jest.fn(),
  deleteShelf: jest.fn()
}));
jest.mock('../utils/previewMode', () => ({ isPreviewMode: () => false, isDemoBuild: false }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ userProfile: { userId: 'reader-a' } }) }));
jest.mock('../context/SessionContext', () => ({ useSession: () => ({ createSession: jest.fn(), getSessionForBook: () => null }) }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ currentTheme: 'study' }) }));
jest.mock('./BookDetail', () => () => null);
jest.mock('../components/ShelfEditor', () => () => null);
jest.mock('../components/BookCard', () => ({ book, onRatingChange }) => (
  <div className="test-book" data-rating={book.rating}>
    {book.title}
    <button className="test-rate" onClick={() => onRatingChange(book.isbn, 5)}>rate</button>
  </div>
));
// Search stand-in: adds one book and records whether the search would close
jest.mock('../components/BookSearch', () => ({ onAddBook }) => (
  <button
    className="test-add"
    onClick={async () => { globalThis.__searchClosed = (await onAddBook({ isbn: 'new-1', title: 'New Book' })) !== false; }}
  >
    add
  </button>
));

const book = (isbn, title, extra = {}) => ({ isbn, title, shelf: 'Want to Read', shelves: [], rating: 0, ...extra });
const flush = () => act(() => new Promise(r => setTimeout(r, 0)));

let container;
let root;
const render = async () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<Library />); });
  await flush();
};
const titles = () => [...container.querySelectorAll('.test-book')].map(n => n.firstChild.textContent);
const errorText = () => container.querySelector('.error-message')?.textContent || '';
const click = async (selector) => {
  await act(async () => { container.querySelector(selector).click(); });
  await flush();
};

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  // CRA resets mock implementations before each test
  libraryService.getShelves.mockResolvedValue({ shelves: [] });
  globalThis.__searchClosed = undefined;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  console.error.mockRestore();
});

test("never uploads books cached on this device into an empty account", async () => {
  localStorage.setItem('pagebound-library', JSON.stringify([book('x1', "Someone Else's Book")]));
  localStorage.setItem('pagebound-library:reader-b', JSON.stringify([book('x2', "Reader B's Book")]));
  libraryService.getLibraryBooks.mockResolvedValue({ books: [] });

  await render();

  expect(titles()).toEqual([]);
  expect(libraryService.addBookToLibrary).not.toHaveBeenCalled();
});

test("offline: shows only this account's saved copy, with a warning", async () => {
  localStorage.setItem('pagebound-library:reader-a', JSON.stringify([book('a1', 'Mine')]));
  localStorage.setItem('pagebound-library:reader-b', JSON.stringify([book('b1', 'Not mine')]));
  libraryService.getLibraryBooks.mockRejectedValue(new Error('offline'));

  await render();

  expect(titles()).toEqual(['Mine']);
  expect(errorText()).toMatch(/copy saved on this device/);
});

test('the server copy replaces this account\'s cache', async () => {
  libraryService.getLibraryBooks.mockResolvedValue({ books: [book('s1', 'From server')] });

  await render();

  expect(titles()).toEqual(['From server']);
  expect(JSON.parse(localStorage.getItem('pagebound-library:reader-a'))[0].title).toBe('From server');
});

test('a failed add is undone, explained, and keeps the search open', async () => {
  libraryService.getLibraryBooks.mockResolvedValue({ books: [book('s1', 'Existing')] });
  libraryService.addBookToLibrary.mockRejectedValue(Object.assign(new Error('500'), { status: 500 }));

  await render();
  await click('.test-add');

  expect(titles()).toEqual(['Existing']);
  expect(errorText()).toMatch(/Couldn't add “New Book”/);
  expect(globalThis.__searchClosed).toBe(false);
  expect(JSON.parse(localStorage.getItem('pagebound-library:reader-a')).map(b => b.isbn)).toEqual(['s1']);
});

test('a successful add stays and closes the search', async () => {
  libraryService.getLibraryBooks.mockResolvedValue({ books: [] });
  libraryService.addBookToLibrary.mockResolvedValue({});

  await render();
  await click('.test-add');

  expect(titles()).toEqual(['New Book']);
  expect(errorText()).toBe('');
  expect(globalThis.__searchClosed).toBe(true);
});

test('a failed update is rolled back and explained', async () => {
  libraryService.getLibraryBooks.mockResolvedValue({ books: [book('s1', 'Existing', { rating: 2 })] });
  libraryService.updateLibraryBook.mockRejectedValue(new Error('500'));

  await render();
  await click('.test-rate');

  expect(container.querySelector('.test-book').dataset.rating).toBe('2');
  expect(errorText()).toMatch(/they've been undone/);
});
