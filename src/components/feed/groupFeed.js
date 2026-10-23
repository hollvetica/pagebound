// Folds busy stretches of the feed into single cards so a day of shelving
// doesn't push everything else out of view. Expects items newest first.
//
//   Same book, same action, different friends  -> "Sam, Leo and Nora added Piranesi"
//   Same friend, same action, different books  -> "Wren added 3 books to Want to Read"
const GROUPABLE = ['started_reading', 'book_added', 'finished_book'];
const WINDOW_HOURS = 48;

const hoursApart = (a, b) => Math.abs(new Date(a) - new Date(b)) / 3600e3;

export function groupFeed(items) {
  const used = new Set();
  const out = [];

  items.forEach((item, index) => {
    if (used.has(item.itemId)) return;
    if (!GROUPABLE.includes(item.type)) {
      out.push(item);
      return;
    }

    const nearby = items.slice(index + 1).filter(o =>
      !used.has(o.itemId) && o.type === item.type && hoursApart(o.createdAt, item.createdAt) <= WINDOW_HOURS);
    const sameBook = nearby.filter(o => o.book?.isbn === item.book?.isbn && o.actor?.userId !== item.actor?.userId);
    const sameActor = nearby.filter(o => o.actor?.userId === item.actor?.userId && o.book?.isbn !== item.book?.isbn);
    const byBook = sameBook.length > 0;
    const members = byBook ? sameBook : sameActor;

    if (!members.length) {
      out.push(item);
      return;
    }

    const all = [item, ...members];
    all.forEach(m => used.add(m.itemId));
    out.push({
      itemId: `g|${all.map(m => m.itemId).join('+')}`,
      type: 'grouped',
      createdAt: item.createdAt,
      actor: byBook ? undefined : item.actor,
      book: byBook ? item.book : undefined,
      shelf: all.every(m => m.shelf === item.shelf) ? item.shelf : undefined,
      group: { by: byBook ? 'book' : 'actor', type: item.type, items: all }
    });
  });

  return out;
}
