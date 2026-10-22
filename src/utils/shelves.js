// Shelf model shared by the Library page and the book sheet.
//
// Every book has one reading status (book.shelf): one of STATUS_SHELF_NAMES.
// It can also sit on any number of the reader's custom shelves
// (book.shelves = [shelfId, ...]).

export const STATUS_SHELVES = [
  { shelfId: 'currently-reading', name: 'Currently Reading', kind: 'status', visibility: 'public' },
  { shelfId: 'want-to-read', name: 'Want to Read', kind: 'status', visibility: 'public' },
  { shelfId: 'finished', name: 'Finished', kind: 'status', visibility: 'public' }
];

export const STATUS_SHELF_NAMES = STATUS_SHELVES.map(s => s.name);

// Older data used "Read" for finished books
export const statusOf = (book) => {
  if (book.shelf === 'Read') return 'Finished';
  return STATUS_SHELF_NAMES.includes(book.shelf) ? book.shelf : 'Want to Read';
};

export const booksOnShelf = (books, shelf) =>
  shelf.kind === 'status'
    ? books.filter(b => statusOf(b) === shelf.name)
    : books.filter(b => (b.shelves || []).includes(shelf.shelfId));
