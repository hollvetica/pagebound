// Offline tests for the Pagebound API Lambdas.
// Run from the repo root:  node backend/tests/api.test.js
const assert = require('assert');

// Safety net: if anything bypasses the fake, it fails fast instead of reaching AWS
process.env.AWS_REGION = 'local-test';
process.env.AWS_ACCESS_KEY_ID = 'test';
process.env.AWS_SECRET_ACCESS_KEY = 'test';
process.env.AWS_ENDPOINT_URL = 'http://127.0.0.1:9';
process.env.AWS_ENDPOINT_URL_DYNAMODB = 'http://127.0.0.1:9';
delete process.env.AWS_PROFILE;

process.env.SESSIONS_TABLE = 'pagebound-sessions';
process.env.MEMBERS_TABLE = 'pagebound-session-members';
process.env.MESSAGES_TABLE = 'pagebound-messages';
process.env.USERS_TABLE = 'pagebound-users';
process.env.FRIENDS_TABLE = 'pagebound-friends';
process.env.LIBRARY_TABLE = 'pagebound-library';
process.env.SHELVES_TABLE = 'pagebound-shelves';

const db = require('./fakeDynamo');
const sessions = require('../lambda/sessionsAPI');
const library = require('../lambda/libraryAPI');

// pagebound-users is keyed by email but queried by userId-index
const users = [
  { email: 'ann@test', userId: 'ann', username: 'ann', displayName: 'Ann' },
  { email: 'bo@test', userId: 'bo', username: 'bo', displayName: 'Bo' },
  { email: 'cy@test', userId: 'cy', username: 'cy', displayName: 'Cy' }
];

function call(handler, method, path, { caller, body, pathParameters = {}, query } = {}) {
  return handler.handler({
    httpMethod: method,
    path,
    pathParameters,
    queryStringParameters: query || null,
    body: body ? JSON.stringify(body) : null,
    requestContext: caller ? { authorizer: { claims: { sub: caller, email: `${caller}@test` } } } : {}
  }).then(r => ({ status: r.statusCode, body: JSON.parse(r.body), headers: r.headers }));
}

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

function seed() {
  db.reset();
  users.forEach(u => db.table('pagebound-users').set(u.email, { ...u }));
  // Ann and Bo are friends (both directions); Cy is nobody's friend
  db.table('pagebound-friends').set('ann|bo', { userId: 'ann', friendUserId: 'bo' });
  db.table('pagebound-friends').set('bo|ann', { userId: 'bo', friendUserId: 'ann' });
}

const book = { bookIsbn: '111', bookTitle: 'Piranesi', bookAuthor: 'Susanna Clarke', totalChapters: 10, trackingMode: 'chapters' };

async function annStartsWithBo(extra = {}) {
  const r = await call(sessions, 'POST', '/sessions', { caller: 'ann', body: { ...book, participantUserIds: ['bo'], ...extra } });
  assert.strictEqual(r.status, 201, JSON.stringify(r.body));
  return r.body.session;
}

// ---------------------------------------------------------------- auth
test('rejects requests without a signed-in caller', async () => {
  const r = await call(sessions, 'POST', '/sessions', { body: book });
  assert.strictEqual(r.status, 401);
  const l = await call(library, 'GET', '/library/ann/books', { pathParameters: { userId: 'ann' } });
  assert.strictEqual(l.status, 401);
});

test('responses always carry CORS headers', async () => {
  const r = await call(sessions, 'GET', '/sessions/nope', { caller: 'ann', pathParameters: { sessionId: 'nope' } });
  assert.strictEqual(r.status, 404);
  assert.strictEqual(r.headers['Access-Control-Allow-Origin'], '*');
});

// ---------------------------------------------------------------- sessions
test('creates a session with a friend; both see it in their list', async () => {
  const s = await annStartsWithBo();
  assert.strictEqual(s.hostUserId, 'ann');
  assert.deepStrictEqual(s.participants.map(p => p.displayName), ['Ann', 'Bo']);

  for (const who of ['ann', 'bo']) {
    const l = await call(sessions, 'GET', `/sessions/users/${who}/list`, { caller: who, pathParameters: { userId: who } });
    assert.strictEqual(l.status, 200);
    assert.strictEqual(l.body.sessions.length, 1, `${who} should see the session`);
  }
});

test('cannot invite someone who is not a friend', async () => {
  const r = await call(sessions, 'POST', '/sessions', { caller: 'ann', body: { ...book, participantUserIds: ['cy'] } });
  assert.strictEqual(r.status, 403);
});

test('one session per book for the host and for invitees', async () => {
  await annStartsWithBo();
  const again = await call(sessions, 'POST', '/sessions', { caller: 'ann', body: { ...book, participantUserIds: [] } });
  assert.strictEqual(again.status, 409);
  const boAgain = await call(sessions, 'POST', '/sessions', { caller: 'bo', body: { ...book, participantUserIds: [] } });
  assert.strictEqual(boAgain.status, 409, 'Bo is already in a session for this book');
  const otherBook = await call(sessions, 'POST', '/sessions', { caller: 'ann', body: { ...book, bookIsbn: '222' } });
  assert.strictEqual(otherBook.status, 201);
});

test('requires a total for the tracking unit', async () => {
  const r = await call(sessions, 'POST', '/sessions', { caller: 'ann', body: { ...book, trackingMode: 'pages', totalChapters: 10 } });
  assert.strictEqual(r.status, 400);
});

test('only members can read a session; cannot list someone else\'s sessions', async () => {
  const s = await annStartsWithBo();
  const cyRead = await call(sessions, 'GET', `/sessions/${s.sessionId}`, { caller: 'cy', pathParameters: { sessionId: s.sessionId } });
  assert.strictEqual(cyRead.status, 403);
  const cyList = await call(sessions, 'GET', '/sessions/users/ann/list', { caller: 'cy', pathParameters: { userId: 'ann' } });
  assert.strictEqual(cyList.status, 403);
});

test('progress updates only change the caller, clamped to the total', async () => {
  const s = await annStartsWithBo();
  const r = await call(sessions, 'PUT', `/sessions/${s.sessionId}/progress`, {
    caller: 'bo', pathParameters: { sessionId: s.sessionId }, body: { userId: 'ann', currentChapter: 99 }
  });
  assert.strictEqual(r.status, 200);
  const byId = Object.fromEntries(r.body.session.participants.map(p => [p.userId, p.currentChapter]));
  assert.deepStrictEqual(byId, { ann: 0, bo: 10 }, 'body userId is ignored; value clamped to totalChapters');
});

// ---------------------------------------------------------------- spoiler gating
test('comments stay hidden (text and author) until the reader reaches them', async () => {
  const s = await annStartsWithBo();
  const id = s.sessionId;
  const pp = { sessionId: id };

  await call(sessions, 'PUT', `/sessions/${id}/progress`, { caller: 'ann', pathParameters: pp, body: { currentChapter: 6 } });
  const post = await call(sessions, 'POST', `/sessions/${id}/messages`, {
    caller: 'ann', pathParameters: pp, body: { message: 'The statues!', position: 5 }
  });
  assert.strictEqual(post.status, 201);

  // Bo is on chapter 0: sees a placeholder only
  let bo = await call(sessions, 'GET', `/sessions/${id}/messages`, { caller: 'bo', pathParameters: pp });
  assert.strictEqual(bo.body.visibleMessages.length, 0);
  assert.strictEqual(bo.body.hiddenMessages.length, 1);
  const hidden = bo.body.hiddenMessages[0];
  assert.strictEqual(hidden.position, 5);
  assert.ok(!('message' in hidden) && !('userId' in hidden) && !('displayName' in hidden), 'no spoilers leak');

  // Bo can't mark it read early
  const early = await call(sessions, 'PUT', `/sessions/${id}/messages/${hidden.messageId}/read`, {
    caller: 'bo', pathParameters: { sessionId: id, messageId: hidden.messageId }
  });
  assert.strictEqual(early.status, 403);

  // Unread count reaches Bo's session list, and the timeline shows where
  let list = await call(sessions, 'GET', '/sessions/users/bo/list', { caller: 'bo', pathParameters: { userId: 'bo' } });
  assert.strictEqual(list.body.sessions[0].unreadCount, 1);
  assert.strictEqual(list.body.sessions[0].unreadVisibleCount, 0);
  const timeline = await call(sessions, 'GET', `/sessions/${id}/unread-timeline`, { caller: 'bo', pathParameters: pp });
  assert.deepStrictEqual(timeline.body.unreadByPosition, { 5: 1 });

  // Bo finishes chapter 5: comment is now visible and can be read
  await call(sessions, 'PUT', `/sessions/${id}/progress`, { caller: 'bo', pathParameters: pp, body: { currentChapter: 5 } });
  bo = await call(sessions, 'GET', `/sessions/${id}/messages`, { caller: 'bo', pathParameters: pp });
  assert.strictEqual(bo.body.visibleMessages.length, 1);
  assert.strictEqual(bo.body.visibleMessages[0].message, 'The statues!');
  const read = await call(sessions, 'PUT', `/sessions/${id}/messages/${hidden.messageId}/read`, {
    caller: 'bo', pathParameters: { sessionId: id, messageId: hidden.messageId }
  });
  assert.strictEqual(read.status, 200);
  list = await call(sessions, 'GET', '/sessions/users/bo/list', { caller: 'bo', pathParameters: { userId: 'bo' } });
  assert.strictEqual(list.body.sessions[0].unreadCount, 0);

  // The author always sees their own comments and has nothing unread
  const ann = await call(sessions, 'GET', `/sessions/${id}/messages`, { caller: 'ann', pathParameters: pp });
  assert.strictEqual(ann.body.visibleMessages.length, 1);
});

test('page-tracked sessions gate by page', async () => {
  const s = await annStartsWithBo({ trackingMode: 'pages', totalPages: 300, totalChapters: null });
  const pp = { sessionId: s.sessionId };
  await call(sessions, 'POST', `/sessions/${s.sessionId}/messages`, { caller: 'ann', pathParameters: pp, body: { message: 'p120', position: 120 } });
  await call(sessions, 'PUT', `/sessions/${s.sessionId}/progress`, { caller: 'bo', pathParameters: pp, body: { currentPage: 119, currentChapter: 50 } });
  let bo = await call(sessions, 'GET', `/sessions/${s.sessionId}/messages`, { caller: 'bo', pathParameters: pp });
  assert.strictEqual(bo.body.hiddenMessages.length, 1, 'chapter progress must not unlock page-tagged comments');
  await call(sessions, 'PUT', `/sessions/${s.sessionId}/progress`, { caller: 'bo', pathParameters: pp, body: { currentPage: 120 } });
  bo = await call(sessions, 'GET', `/sessions/${s.sessionId}/messages`, { caller: 'bo', pathParameters: pp });
  assert.strictEqual(bo.body.visibleMessages.length, 1);
});

test('non-members cannot post or read messages', async () => {
  const s = await annStartsWithBo();
  const pp = { sessionId: s.sessionId };
  const post = await call(sessions, 'POST', `/sessions/${s.sessionId}/messages`, { caller: 'cy', pathParameters: pp, body: { message: 'hi' } });
  assert.strictEqual(post.status, 403);
  const read = await call(sessions, 'GET', `/sessions/${s.sessionId}/messages`, { caller: 'cy', pathParameters: pp });
  assert.strictEqual(read.status, 403);
});

test('only the host deletes; delete removes members and messages', async () => {
  const s = await annStartsWithBo();
  const pp = { sessionId: s.sessionId };
  await call(sessions, 'POST', `/sessions/${s.sessionId}/messages`, { caller: 'bo', pathParameters: pp, body: { message: 'hey', position: 0 } });
  const boDelete = await call(sessions, 'DELETE', `/sessions/${s.sessionId}`, { caller: 'bo', pathParameters: pp });
  assert.strictEqual(boDelete.status, 403);
  const annDelete = await call(sessions, 'DELETE', `/sessions/${s.sessionId}`, { caller: 'ann', pathParameters: pp });
  assert.strictEqual(annDelete.status, 200);
  assert.strictEqual(db.table('pagebound-session-members').size, 0);
  assert.strictEqual(db.table('pagebound-messages').size, 0);
  // and the book is free for a new session
  const again = await call(sessions, 'POST', '/sessions', { caller: 'ann', body: book });
  assert.strictEqual(again.status, 201);
});

// ---------------------------------------------------------------- library
test('library: owner-only, add / duplicate / update / stats / delete', async () => {
  const pp = { userId: 'ann' };
  const add = await call(library, 'POST', '/library/ann/books', {
    caller: 'ann', pathParameters: pp, body: { isbn: '111', title: 'Piranesi', totalPages: 272, injected: 'x' }
  });
  assert.strictEqual(add.status, 201);
  assert.strictEqual(add.body.book.totalPages, 272);
  assert.ok(!('injected' in add.body.book), 'unknown fields are dropped');

  const dup = await call(library, 'POST', '/library/ann/books', { caller: 'ann', pathParameters: pp, body: { isbn: '111', title: 'Piranesi' } });
  assert.strictEqual(dup.status, 409);

  const bo = await call(library, 'GET', '/library/ann/books', { caller: 'bo', pathParameters: pp });
  assert.strictEqual(bo.status, 403, 'others cannot read the library yet');

  const upd = await call(library, 'PUT', '/library/ann/books/111', {
    caller: 'ann', pathParameters: { userId: 'ann', isbn: '111' }, body: { shelf: 'Finished', rating: 5, userId: 'bo' }
  });
  assert.strictEqual(upd.status, 200);
  assert.strictEqual(upd.body.book.userId, 'ann');
  assert.ok(upd.body.book.completedAt, 'finishing sets completedAt');

  const stats = await call(library, 'GET', '/library/ann/stats', { caller: 'ann', pathParameters: pp });
  assert.strictEqual(stats.body.booksRead, 1);

  const missing = await call(library, 'PUT', '/library/ann/books/999', { caller: 'ann', pathParameters: { userId: 'ann', isbn: '999' }, body: { rating: 1 } });
  assert.strictEqual(missing.status, 404);

  const del = await call(library, 'DELETE', '/library/ann/books/111', { caller: 'ann', pathParameters: { userId: 'ann', isbn: '111' } });
  assert.strictEqual(del.status, 200);
  const list = await call(library, 'GET', '/library/ann/books', { caller: 'ann', pathParameters: pp });
  assert.strictEqual(list.body.count, 0);
});

// ---------------------------------------------------------------- friends & users
process.env.FRIEND_REQUESTS_TABLE = 'pagebound-friend-requests';
process.env.INVITE_LINKS_TABLE = 'pagebound-invite-links';
const friends = require('../lambda/friendsAPI');
const userApi = require('../lambda/userAPI.live');

test('friends: callers can only act on their own account', async () => {
  const own = await call(friends, 'GET', '/friends/ann/list', { caller: 'ann', pathParameters: { userId: 'ann' } });
  assert.strictEqual(own.status, 200);
  assert.strictEqual(own.body.count, 1);
  const other = await call(friends, 'GET', '/friends/ann/list', { caller: 'cy', pathParameters: { userId: 'ann' } });
  assert.strictEqual(other.status, 403);
  const anon = await call(friends, 'GET', '/friends/ann/list', { pathParameters: { userId: 'ann' } });
  assert.strictEqual(anon.status, 401);
  const removeOther = await call(friends, 'DELETE', '/friends/ann/remove/bo', { caller: 'cy', pathParameters: { userId: 'ann', friendUserId: 'bo' } });
  assert.strictEqual(removeOther.status, 403);
});

test('users: own profile only; admin actions restricted', async () => {
  const proxy = (p) => ({ proxy: p });
  const own = await call(userApi, 'GET', '/users/ann@test', { caller: 'ann', pathParameters: proxy('ann@test') });
  assert.strictEqual(own.status, 200);
  const other = await call(userApi, 'GET', '/users/bo@test', { caller: 'ann', pathParameters: proxy('bo@test') });
  assert.strictEqual(other.status, 403);
  const rename = await call(userApi, 'PUT', '/users/bo@test/username', { caller: 'ann', pathParameters: proxy('bo@test/username'), body: { newUsername: 'x' } });
  assert.strictEqual(rename.status, 403);
  const selfAdmin = await call(userApi, 'PUT', '/users/ann@test/admin', { caller: 'ann', pathParameters: proxy('ann@test/admin'), body: { isAdmin: true } });
  assert.strictEqual(selfAdmin.status, 403, 'only the super admin can grant admin');
  const list = await call(userApi, 'GET', '/users/admin', { caller: 'ann', pathParameters: proxy('admin') });
  assert.strictEqual(list.status, 403);
});

// ---------------------------------------------------------------- shelves
const shelvesPath = (who) => ({ path: `/library/${who}/shelves`, pathParameters: { userId: who } });

test('shelves: status shelves by default, create / rename / visibility / delete', async () => {
  const { path, pathParameters } = shelvesPath('ann');
  let list = await call(library, 'GET', path, { caller: 'ann', pathParameters });
  assert.deepStrictEqual(list.body.shelves.map(s => s.name), ['Currently Reading', 'Want to Read', 'Finished']);
  assert.ok(list.body.shelves.every(s => s.visibility === 'public' && s.kind === 'status'));

  const created = await call(library, 'POST', path, { caller: 'ann', pathParameters, body: { name: "  Emma's   book club ", visibility: 'private' } });
  assert.strictEqual(created.status, 201);
  assert.strictEqual(created.body.shelf.name, "Emma's book club");
  assert.ok(!('userId' in created.body.shelf));
  const id = created.body.shelf.shelfId;

  const dupe = await call(library, 'POST', path, { caller: 'ann', pathParameters, body: { name: "emma's BOOK club" } });
  assert.strictEqual(dupe.status, 409);
  const statusName = await call(library, 'POST', path, { caller: 'ann', pathParameters, body: { name: 'finished' } });
  assert.strictEqual(statusName.status, 409, 'cannot reuse a status shelf name');
  const empty = await call(library, 'POST', path, { caller: 'ann', pathParameters, body: { name: '   ' } });
  assert.strictEqual(empty.status, 400);

  const one = (sid) => ({ caller: 'ann', pathParameters: { userId: 'ann', shelfId: sid } });
  const renamed = await call(library, 'PUT', `${path}/${id}`, { ...one(id), body: { name: 'Spooky October Reads', visibility: 'public' } });
  assert.strictEqual(renamed.status, 200);
  assert.strictEqual(renamed.body.shelf.visibility, 'public');

  const statusPrivate = await call(library, 'PUT', `${path}/want-to-read`, { ...one('want-to-read'), body: { visibility: 'private' } });
  assert.strictEqual(statusPrivate.status, 200);
  const statusRename = await call(library, 'PUT', `${path}/want-to-read`, { ...one('want-to-read'), body: { name: 'Someday' } });
  assert.strictEqual(statusRename.status, 400);
  const statusDelete = await call(library, 'DELETE', `${path}/finished`, one('finished'));
  assert.strictEqual(statusDelete.status, 400);

  list = await call(library, 'GET', path, { caller: 'ann', pathParameters });
  assert.deepStrictEqual(list.body.shelves.map(s => `${s.name}:${s.visibility}`),
    ['Currently Reading:public', 'Want to Read:private', 'Finished:public', 'Spooky October Reads:public']);

  const bo = await call(library, 'GET', '/library/ann/shelves', { caller: 'bo', pathParameters: { userId: 'ann' } });
  assert.strictEqual(bo.status, 403);
});

test('books join custom shelves (own shelves only) and leave when a shelf is deleted', async () => {
  const { path, pathParameters } = shelvesPath('ann');
  const shelf = (await call(library, 'POST', path, { caller: 'ann', pathParameters, body: { name: 'Book club' } })).body.shelf;
  const boShelf = (await call(library, 'POST', '/library/bo/shelves', { caller: 'bo', pathParameters: { userId: 'bo' }, body: { name: 'Bo only' } })).body.shelf;

  const add = await call(library, 'POST', '/library/ann/books', {
    caller: 'ann', pathParameters: { userId: 'ann' },
    body: { isbn: '111', title: 'Piranesi', shelves: [shelf.shelfId, boShelf.shelfId, 'made-up'] }
  });
  assert.deepStrictEqual(add.body.book.shelves, [shelf.shelfId], "other readers' and unknown shelves are dropped");

  const bookKey = { caller: 'ann', pathParameters: { userId: 'ann', isbn: '111' } };
  const cleared = await call(library, 'PUT', '/library/ann/books/111', { ...bookKey, body: { shelves: [] } });
  assert.deepStrictEqual(cleared.body.book.shelves, []);
  await call(library, 'PUT', '/library/ann/books/111', { ...bookKey, body: { shelves: [shelf.shelfId] } });

  const del = await call(library, 'DELETE', `${path}/${shelf.shelfId}`, { caller: 'ann', pathParameters: { userId: 'ann', shelfId: shelf.shelfId } });
  assert.strictEqual(del.status, 200);
  const books = await call(library, 'GET', '/library/ann/books', { caller: 'ann', pathParameters: { userId: 'ann' } });
  assert.strictEqual(books.body.count, 1, 'the book stays in the library');
  assert.deepStrictEqual(books.body.books[0].shelves, []);
});

// ---------------------------------------------------------------- book stats
test('book stats: totals across readers, no identities', async () => {
  for (const [who, rating] of [['ann', 4], ['bo', 5], ['cy', 0]]) {
    await call(library, 'POST', `/library/${who}/books`, {
      caller: who, pathParameters: { userId: who }, body: { isbn: '111', title: 'Piranesi', rating }
    });
  }
  await annStartsWithBo();

  const stats = await call(library, 'GET', '/books/111/stats', { caller: 'cy', pathParameters: { isbn: '111' } });
  assert.strictEqual(stats.status, 200);
  assert.deepStrictEqual(stats.body, {
    isbn: '111', inLibraries: 3, inMyLibrary: true, activeSessions: 1, ratingCount: 2, ratingAverage: 4.5
  });

  const none = await call(library, 'GET', '/books/999/stats', { caller: 'cy', pathParameters: { isbn: '999' } });
  assert.deepStrictEqual(none.body, {
    isbn: '999', inLibraries: 0, inMyLibrary: false, activeSessions: 0, ratingCount: 0, ratingAverage: null
  });

  const anon = await call(library, 'GET', '/books/111/stats', { pathParameters: { isbn: '111' } });
  assert.strictEqual(anon.status, 401);
});

(async () => {
  const quiet = console.log;
  let failed = 0;
  for (const [name, fn] of tests) {
    seed();
    console.log = () => {};
    try {
      await fn();
      console.log = quiet;
      console.log(`  ✓ ${name}`);
    } catch (error) {
      console.log = quiet;
      failed++;
      console.log(`  ✗ ${name}\n    ${error.message}`);
    }
  }
  console.log(`\n${tests.length - failed}/${tests.length} passed`);
  process.exit(failed ? 1 : 0);
})();
