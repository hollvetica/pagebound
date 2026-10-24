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
process.env.ACTIVITY_TABLE = 'pagebound-activity';
process.env.RECOMMENDATIONS_TABLE = 'pagebound-recommendations';
process.env.REACTIONS_TABLE = 'pagebound-reactions';
process.env.REVIEWS_TABLE = 'pagebound-reviews';
process.env.AVATAR_BUCKET = 'test-avatars';

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

// ---------------------------------------------------------------- sign-up profiles
const trigger = require('../lambda/createUserProfile');
const usersTable = () => db.table('pagebound-users');

const signUpEvent = (triggerSource, attrs) => ({
  triggerSource,
  request: { userAttributes: { sub: 'new-sub', email: 'New.Reader@Test', ...attrs } }
});

// User API call with full token claims (sub, email, custom:username)
function callUserApi(method, proxy, { claims, body } = {}) {
  return userApi.handler({
    httpMethod: method,
    path: `/users/${proxy}`,
    pathParameters: { proxy },
    body: body ? JSON.stringify(body) : null,
    requestContext: { authorizer: { claims } }
  }).then(r => ({ status: r.statusCode, body: JSON.parse(r.body) }));
}

test('sign-up trigger: creates the profile with the chosen username', async () => {
  const event = signUpEvent('PostConfirmation_ConfirmSignUp', { 'custom:username': 'Night Owl' });
  const result = await trigger.handler(event);
  assert.strictEqual(result, event, 'always hands the event back to Cognito');
  const profile = usersTable().get('new.reader@test');
  assert.ok(profile, 'keyed by lowercase email');
  assert.strictEqual(profile.userId, 'new-sub');
  assert.strictEqual(profile.username, 'Night_Owl');
  assert.strictEqual(profile.displayName, 'Night_Owl');
  assert.strictEqual(profile.isAdmin, false);
  assert.strictEqual(profile.isPrivate, false);
});

test('sign-up trigger: a password reset never touches the profile', async () => {
  usersTable().set('new.reader@test', { email: 'new.reader@test', userId: 'new-sub', username: 'owl', displayName: 'Owl', tagline: 'Hi', avatarUrl: 'x.jpg', isPrivate: true });
  const before = JSON.stringify(usersTable().get('new.reader@test'));
  await trigger.handler(signUpEvent('PostConfirmation_ConfirmForgotPassword'));
  assert.strictEqual(JSON.stringify(usersTable().get('new.reader@test')), before);

  usersTable().delete('new.reader@test');
  await trigger.handler(signUpEvent('PostConfirmation_ConfirmForgotPassword'));
  assert.ok(!usersTable().has('new.reader@test'), 'a reset creates nothing either');
});

test('sign-up trigger: never overwrites an existing profile', async () => {
  usersTable().set('new.reader@test', { email: 'new.reader@test', userId: 'new-sub', username: 'owl', tagline: 'Keep me' });
  await trigger.handler(signUpEvent('PostConfirmation_ConfirmSignUp', { 'custom:username': 'different' }));
  assert.strictEqual(usersTable().get('new.reader@test').tagline, 'Keep me');
  assert.strictEqual(usersTable().get('new.reader@test').username, 'owl');
});

test('sign-up trigger: usernames are unique ignoring case, and never come from the email', async () => {
  await trigger.handler(signUpEvent('PostConfirmation_ConfirmSignUp', { 'custom:username': 'ANN' }));
  assert.strictEqual(usersTable().get('new.reader@test').username, 'ANN2', 'ann is taken');

  await trigger.handler({ ...signUpEvent('PostConfirmation_ConfirmSignUp'), request: { userAttributes: { sub: 's2', email: 'priya.k@test' } } });
  const fallback = usersTable().get('priya.k@test').username;
  assert.match(fallback, /^reader\d+$/);
  assert.ok(!fallback.includes('priya'));

  await trigger.handler({ ...signUpEvent('PostConfirmation_ConfirmSignUp'), request: { userAttributes: { sub: 's3', email: 'x@test', 'custom:username': '!!' } } });
  assert.match(usersTable().get('x@test').username, /^reader\d+$/, 'an unusable choice falls back too');
});

test('sign-up trigger: a database failure still lets the sign-up finish', async () => {
  const table = process.env.USERS_TABLE;
  process.env.USERS_TABLE = '';
  try {
    const event = signUpEvent('PostConfirmation_ConfirmSignUp');
    assert.strictEqual(await trigger.handler(event), event);
  } finally {
    process.env.USERS_TABLE = table;
  }
});

test('users: a signed-in reader without a profile gets one (safety net)', async () => {
  const claims = { sub: 'wa-sub', email: 'Wa@Test', 'custom:username': 'wanderer' };
  const first = await callUserApi('GET', 'Wa@Test', { claims });
  assert.strictEqual(first.status, 200);
  assert.strictEqual(first.body.username, 'wanderer');
  assert.strictEqual(first.body.userId, 'wa-sub');
  assert.ok(usersTable().has('wa@test'));

  const again = await callUserApi('GET', 'wa@test', { claims });
  assert.strictEqual(again.body.createdAt, first.body.createdAt, 'not recreated');
  assert.strictEqual(usersTable().size, users.length + 1);
});

test('users: renames must be valid and free; no profile is created by renaming', async () => {
  const ann = { sub: 'ann', email: 'ann@test' };
  usersTable().get('bo@test').username = 'Bookish';
  const taken = await callUserApi('PUT', 'ann@test/username', { claims: ann, body: { newUsername: 'BOOKISH' } });
  assert.strictEqual(taken.status, 409);
  const invalid = await callUserApi('PUT', 'ann@test/username', { claims: ann, body: { newUsername: 'a b!' } });
  assert.strictEqual(invalid.status, 400);
  const ok = await callUserApi('PUT', 'ann@test/username', { claims: ann, body: { newUsername: 'Ann.Reads' } });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(usersTable().get('ann@test').username, 'Ann.Reads');
  const ownCase = await callUserApi('PUT', 'ann@test/username', { claims: ann, body: { newUsername: 'ann.reads' } });
  assert.strictEqual(ownCase.status, 200, 'changing the case of your own name is fine');

  const ghost = { sub: 'ghost', email: 'ghost@test' };
  const missing = await callUserApi('PUT', 'ghost@test/username', { claims: ghost, body: { newUsername: 'ghosty' } });
  assert.notStrictEqual(missing.status, 200);
  assert.ok(!usersTable().has('ghost@test'), 'no half-empty profile');

  const check = (name) => callUserApi('GET', `check-username/${name}`, { claims: ann }).then(r => r.body.available);
  assert.strictEqual(await check('bookish'), false, 'taken, ignoring case');
  assert.strictEqual(await check('somebody_new'), true);
  assert.strictEqual(await check('x'), false, 'too short');
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

// ---------------------------------------------------------------- notifications
const listFor = async (who) =>
  (await call(sessions, 'GET', `/sessions/users/${who}/list`, { caller: who, pathParameters: { userId: who } })).body.sessions;

test('notifications: invite badge, new comments since last seen, cleared by seen/post/progress', async () => {
  const s = await annStartsWithBo();
  const pp = { sessionId: s.sessionId };

  // Host has seen it; the invitee has an invitation waiting
  assert.deepStrictEqual((await listFor('ann'))[0].newCount, 0);
  let bo = (await listFor('bo'))[0];
  assert.strictEqual(bo.isNewInvite, true);
  assert.strictEqual(bo.newCount, 1);

  // Bo opens it
  const seen = await call(sessions, 'PUT', `/sessions/${s.sessionId}/seen`, { caller: 'bo', pathParameters: pp });
  assert.strictEqual(seen.status, 200);
  bo = (await listFor('bo'))[0];
  assert.strictEqual(bo.isNewInvite, false);
  assert.strictEqual(bo.newCount, 0);

  // Ann comments twice (one ahead of Bo): Bo is notified of both, and one is waiting
  await new Promise(r => setTimeout(r, 5));
  await call(sessions, 'POST', `/sessions/${s.sessionId}/messages`, { caller: 'ann', pathParameters: pp, body: { message: 'a', position: 0 } });
  await call(sessions, 'POST', `/sessions/${s.sessionId}/messages`, { caller: 'ann', pathParameters: pp, body: { message: 'b', position: 4 } });
  bo = (await listFor('bo'))[0];
  assert.strictEqual(bo.newCount, 2);
  assert.strictEqual(bo.waitingCount, 1);
  assert.strictEqual((await listFor('ann'))[0].newCount, 0, 'your own comments never notify you');

  // Updating progress counts as catching up
  await new Promise(r => setTimeout(r, 5));
  await call(sessions, 'PUT', `/sessions/${s.sessionId}/progress`, { caller: 'bo', pathParameters: pp, body: { currentChapter: 4 } });
  bo = (await listFor('bo'))[0];
  assert.strictEqual(bo.newCount, 0);
  assert.strictEqual(bo.waitingCount, 0);

  const outsider = await call(sessions, 'PUT', `/sessions/${s.sessionId}/seen`, { caller: 'cy', pathParameters: pp });
  assert.strictEqual(outsider.status, 403);
});

// ---------------------------------------------------------------- invite & leave
test('invite friends to an existing session; friends only, one session per book', async () => {
  // Ann starts solo; Bo and Cy become Ann's friends, Cy is not Bo's
  const solo = await call(sessions, 'POST', '/sessions', { caller: 'ann', body: book });
  const id = solo.body.session.sessionId;
  const pp = { sessionId: id };

  const notFriend = await call(sessions, 'POST', `/sessions/${id}/participants`, { caller: 'ann', pathParameters: pp, body: { userIds: ['cy'] } });
  assert.strictEqual(notFriend.status, 403);

  const added = await call(sessions, 'POST', `/sessions/${id}/participants`, { caller: 'ann', pathParameters: pp, body: { userIds: ['bo', 'bo', 'ann'] } });
  assert.strictEqual(added.status, 200);
  assert.deepStrictEqual(added.body.session.participants.map(p => p.userId), ['ann', 'bo']);
  assert.strictEqual((await listFor('bo'))[0].isNewInvite, true);

  const nobodyNew = await call(sessions, 'POST', `/sessions/${id}/participants`, { caller: 'ann', pathParameters: pp, body: { userIds: ['bo'] } });
  assert.strictEqual(nobodyNew.status, 400);

  const outsider = await call(sessions, 'POST', `/sessions/${id}/participants`, { caller: 'cy', pathParameters: pp, body: { userIds: ['ann'] } });
  assert.strictEqual(outsider.status, 403);

  // Bo can't be pulled into a second session for the same book
  db.table('pagebound-friends').set('ann|cy', { userId: 'ann', friendUserId: 'cy' });
  db.table('pagebound-friends').set('cy|ann', { userId: 'cy', friendUserId: 'ann' });
  db.table('pagebound-friends').set('cy|bo', { userId: 'cy', friendUserId: 'bo' });
  const cyOwn = await call(sessions, 'POST', '/sessions', { caller: 'cy', body: book });
  assert.strictEqual(cyOwn.status, 201, "Cy is not in Ann's session, so Cy can start one");
  const inviteCy = await call(sessions, 'POST', `/sessions/${id}/participants`, { caller: 'ann', pathParameters: pp, body: { userIds: ['cy'] } });
  assert.strictEqual(inviteCy.status, 409, 'Cy already has a session for this book');
});

test('invitees can leave (freeing the book); the host cannot leave; nobody can remove others', async () => {
  const s = await annStartsWithBo();
  const pp = (userId) => ({ sessionId: s.sessionId, userId });

  const kick = await call(sessions, 'DELETE', `/sessions/${s.sessionId}/participants/bo`, { caller: 'ann', pathParameters: pp('bo') });
  assert.strictEqual(kick.status, 403);
  const hostLeave = await call(sessions, 'DELETE', `/sessions/${s.sessionId}/participants/ann`, { caller: 'ann', pathParameters: pp('ann') });
  assert.strictEqual(hostLeave.status, 400);

  const leave = await call(sessions, 'DELETE', `/sessions/${s.sessionId}/participants/bo`, { caller: 'bo', pathParameters: pp('bo') });
  assert.strictEqual(leave.status, 200);
  assert.strictEqual((await listFor('bo')).length, 0);
  const read = await call(sessions, 'GET', `/sessions/${s.sessionId}`, { caller: 'bo', pathParameters: { sessionId: s.sessionId } });
  assert.strictEqual(read.status, 403, 'no longer a member');

  const boOwn = await call(sessions, 'POST', '/sessions', { caller: 'bo', body: book });
  assert.strictEqual(boOwn.status, 201, 'Bo can start their own session for the book now');
});

// ---------------------------------------------------------------- feed
const social = require('../lambda/socialAPI');
const feedOf = async (who) => (await call(social, 'GET', '/feed', { caller: who, query: { include: 'trending' } })).body;
const addBook = (who, isbn, extra = {}) => call(library, 'POST', `/library/${who}/books`, {
  caller: who, pathParameters: { userId: who }, body: { isbn, title: `Book ${isbn}`, ...extra }
});

test('feed: friends\' library and session activity, newest first; strangers as community', async () => {
  await addBook('bo', '111');
  await new Promise(r => setTimeout(r, 5));
  await call(library, 'PUT', '/library/bo/books/111', { caller: 'bo', pathParameters: { userId: 'bo', isbn: '111' }, body: { shelf: 'Currently Reading' } });
  await new Promise(r => setTimeout(r, 5));
  await call(library, 'PUT', '/library/bo/books/111', { caller: 'bo', pathParameters: { userId: 'bo', isbn: '111' }, body: { rating: 4 } });
  await addBook('cy', '222'); // Cy is not Ann's friend
  await new Promise(r => setTimeout(r, 5));
  await call(sessions, 'POST', '/sessions', { caller: 'bo', body: { ...book, bookIsbn: '333' } });

  const feed = await feedOf('ann');
  const fromFriends = feed.items.filter(i => i.audience !== 'community');
  assert.deepStrictEqual(fromFriends.map(i => `${i.actor.displayName}:${i.type}`),
    ['Bo:session_started', 'Bo:started_reading', 'Bo:book_added'], 'rating changes are not events');
  assert.strictEqual(fromFriends[0].session.readers, 1);
  assert.deepStrictEqual(feed.items.filter(i => i.audience === 'community').map(i => `${i.actor.displayName}:${i.type}`),
    ['Cy:book_added'], 'a public stranger shows up as community');
  assert.deepStrictEqual(feed.reactionSet, ['❤️', '🔥', '😂', '😮', '📚']);
  const cyFeed = (await feedOf('cy')).items;
  assert.ok(cyFeed.length > 0 && cyFeed.every(i => i.audience === 'community'), 'Cy has no friends, so only community');
});

test('feed respects privacy: private status shelves and private profiles', async () => {
  await addBook('bo', '111');
  await call(library, 'PUT', '/library/bo/shelves/want-to-read', {
    caller: 'bo', pathParameters: { userId: 'bo', shelfId: 'want-to-read' }, body: { visibility: 'private' }
  });
  assert.strictEqual((await feedOf('ann')).items.length, 0, 'making the shelf private hides past events too');

  await addBook('bo', '444', { shelf: 'Currently Reading' });
  assert.strictEqual((await feedOf('ann')).items.length, 1);

  db.table('pagebound-users').get('bo@test').isPrivate = true;
  assert.strictEqual((await feedOf('ann')).items.length, 0);
});

test('reactions: preset only, one per person, toggle off, friends only', async () => {
  await addBook('bo', '111');
  const item = (await feedOf('ann')).items[0];
  const react = (who, emoji) => call(social, 'PUT', `/feed/items/${encodeURIComponent(item.itemId)}/reactions`, {
    caller: who, pathParameters: { itemId: encodeURIComponent(item.itemId) }, body: { emoji }
  });

  assert.strictEqual((await react('ann', '💩')).status, 400);
  assert.deepStrictEqual((await react('ann', '❤️')).body.reactions, { counts: { '❤️': 1 }, mine: '❤️' });
  assert.deepStrictEqual((await react('ann', '🔥')).body.reactions, { counts: { '🔥': 1 }, mine: '🔥' }, 'changing replaces');
  assert.deepStrictEqual((await react('bo', '🔥')).body.reactions, { counts: { '🔥': 2 }, mine: '🔥' }, 'the actor can react too');
  db.table('pagebound-users').get('bo@test').isPrivate = true;
  assert.strictEqual((await react('cy', '❤️')).status, 403, 'strangers cannot react to a private reader');
  db.table('pagebound-users').get('bo@test').isPrivate = false;
  assert.deepStrictEqual((await react('ann', null)).body.reactions, { counts: { '🔥': 1 }, mine: null });

  const feed = await feedOf('ann');
  assert.deepStrictEqual(feed.items[0].reactions, { counts: { '🔥': 1 }, mine: null });
});

// ---------------------------------------------------------------- everyone feed & bots
const addBot = (name) => db.table('pagebound-users').set(`${name}@bots`, {
  email: `${name}@bots`, userId: `bot-${name}`, username: `${name}.reads`, displayName: name, isBot: true
});
const showBotsTo = (who) => { db.table('pagebound-users').get(`${who}@test`).showBots = true; };

test('community: public strangers only; private readers and private shelves stay out', async () => {
  await addBook('cy', '222');
  const react = (who, itemId) => call(social, 'PUT', `/feed/items/${encodeURIComponent(itemId)}/reactions`, {
    caller: who, pathParameters: { itemId: encodeURIComponent(itemId) }, body: { emoji: '❤️' }
  });
  const item = (await feedOf('ann')).items.find(i => i.audience === 'community');
  assert.strictEqual(item.actor.displayName, 'Cy');
  assert.strictEqual((await react('ann', item.itemId)).status, 200, 'anyone can react to public activity');

  await call(library, 'PUT', '/library/cy/shelves/want-to-read', {
    caller: 'cy', pathParameters: { userId: 'cy', shelfId: 'want-to-read' }, body: { visibility: 'private' }
  });
  assert.strictEqual((await feedOf('ann')).items.length, 0, 'private shelf');

  await addBook('cy', '333', { shelf: 'Currently Reading' });
  assert.strictEqual((await feedOf('ann')).items.length, 1);
  db.table('pagebound-users').get('cy@test').isPrivate = true;
  assert.strictEqual((await feedOf('ann')).items.length, 0, 'private profile leaves the public feed');
});

test('community: a book three readers picked up this week is trending', async () => {
  for (const who of ['ann', 'bo', 'cy']) await addBook(who, '777', { title: 'The Starless Sea' });
  const trending = (await feedOf('ann')).items.filter(i => i.type === 'trending');
  assert.strictEqual(trending.length, 0, 'the caller does not count toward their own trending');

  db.table('pagebound-users').set('di@test', { email: 'di@test', userId: 'di', username: 'di', displayName: 'Di' });
  await addBook('di', '777', { title: 'The Starless Sea' });
  const [t] = (await feedOf('ann')).items.filter(i => i.type === 'trending');
  assert.strictEqual(t.count, 3);
  assert.strictEqual(t.audience, 'community');
  assert.strictEqual(t.book.isbn, '777');
  assert.ok(!('reactions' in t));

  const older = (await call(social, 'GET', '/feed', { caller: 'ann' })).body.items;
  assert.ok(older.length > 0 && older.every(i => i.actor), 'apps that don\'t ask get no actor-less items');
});

test('bots: hidden from everyone without showBots; visible with it', async () => {
  addBot('margot');
  await addBook('bot-margot', '888', { rating: 5 });
  await call(social, 'PUT', '/books/888/reviews/mine', {
    caller: 'bot-margot', pathParameters: { isbn: '888' }, body: { rating: 5, text: 'Loved it', book: { title: 'Circe' } }
  });
  const reviewsFor = (who) => call(social, 'GET', '/books/888/reviews', { caller: who, pathParameters: { isbn: '888' } }).then(r => r.body);
  const statsFor = (who) => call(library, 'GET', '/books/888/stats', { caller: who, pathParameters: { isbn: '888' } }).then(r => r.body);
  const searchFor = (who) => call(friends, 'GET', `/friends/${who}/search`, { caller: who, pathParameters: { userId: who }, query: { q: 'marg' } }).then(r => r.body.users);
  const botsIn = (feed) => feed.items.filter(i => i.actor?.userId === 'bot-margot').length;

  assert.strictEqual(botsIn(await feedOf('ann')), 0);
  assert.strictEqual((await reviewsFor('ann')).count, 0);
  assert.strictEqual((await statsFor('ann')).inLibraries, 0);
  assert.deepStrictEqual(await searchFor('ann'), []);
  const botItem = (await call(library, 'GET', '/library/bot-margot/books', { caller: 'bot-margot', pathParameters: { userId: 'bot-margot' } })).status;
  assert.strictEqual(botItem, 200);

  showBotsTo('ann');
  assert.ok(botsIn(await feedOf('ann')) > 0);
  assert.strictEqual((await reviewsFor('ann')).count, 1);
  assert.strictEqual((await statsFor('ann')).inLibraries, 1);
  assert.deepStrictEqual((await searchFor('ann')).map(u => u.userId), ['bot-margot']);

  assert.strictEqual(botsIn(await feedOf('bo')), 0, 'other readers still never see bots');
});

test('recommendations: friends only; appear in the recipient\'s feed with the note', async () => {
  const send = (who, toUserIds, note) => call(social, 'POST', '/recommendations', {
    caller: who, body: { toUserIds, note, book: { isbn: '555', title: 'Circe', author: 'Madeline Miller' } }
  });
  assert.strictEqual((await send('ann', ['cy'])).status, 403);
  assert.strictEqual((await send('ann', [])).status, 400);
  const sent = await send('ann', ['bo', 'bo', 'ann'], '  You will love this  ');
  assert.strictEqual(sent.status, 201);
  assert.strictEqual(sent.body.sent, 1);

  const bo = await feedOf('bo');
  assert.strictEqual(bo.items.length, 1);
  assert.strictEqual(bo.items[0].type, 'recommendation');
  assert.strictEqual(bo.items[0].actor.displayName, 'Ann');
  assert.strictEqual(bo.items[0].note, 'You will love this');
  assert.strictEqual(bo.items[0].book.title, 'Circe');

  const reactByBo = await call(social, 'PUT', `/feed/items/x/reactions`, {
    caller: 'bo', pathParameters: { itemId: encodeURIComponent(bo.items[0].itemId) }, body: { emoji: '📚' }
  });
  assert.strictEqual(reactByBo.status, 200);
});

// ---------------------------------------------------------------- friends' shelves
test('public library: friends see public shelves with books; private hidden; strangers refused', async () => {
  const lib = (who, owner) => call(library, 'GET', `/library/${owner}/public`, { caller: who, pathParameters: { userId: owner } });
  await addBook('bo', '111');
  await addBook('bo', '222', { shelf: 'Currently Reading' });
  const club = (await call(library, 'POST', '/library/bo/shelves', { caller: 'bo', pathParameters: { userId: 'bo' }, body: { name: 'Club', visibility: 'public' } })).body.shelf;
  const secret = (await call(library, 'POST', '/library/bo/shelves', { caller: 'bo', pathParameters: { userId: 'bo' }, body: { name: 'Secret', visibility: 'private' } })).body.shelf;
  await call(library, 'PUT', '/library/bo/books/111', { caller: 'bo', pathParameters: { userId: 'bo', isbn: '111' }, body: { shelves: [club.shelfId, secret.shelfId] } });
  await call(library, 'PUT', '/library/bo/shelves/want-to-read', { caller: 'bo', pathParameters: { userId: 'bo', shelfId: 'want-to-read' }, body: { visibility: 'private' } });

  const seen = await lib('ann', 'bo');
  assert.strictEqual(seen.status, 200);
  assert.deepStrictEqual(seen.body.shelves.map(s => `${s.name}:${s.books.map(b => b.isbn).join(',')}`),
    ['Currently Reading:222', 'Club:111'], 'private shelves and empty shelves are left out');
  assert.ok(!('shelves' in seen.body.shelves[1].books[0]), 'only a book card is shared');

  assert.strictEqual((await lib('cy', 'bo')).status, 403);
  db.table('pagebound-users').get('bo@test').isPrivate = true;
  assert.deepStrictEqual((await lib('ann', 'bo')).body, { isPrivate: true, shelves: [] });
});

// ---------------------------------------------------------------- reviews
const reviewsOf = async (who, isbn) =>
  (await call(social, 'GET', `/books/${isbn}/reviews`, { caller: who, pathParameters: { isbn } })).body;
const review = (who, isbn, rating, text) => call(social, 'PUT', `/books/${isbn}/reviews/mine`, {
  caller: who, pathParameters: { isbn }, body: { rating, text, book: { title: `Book ${isbn}`, author: 'A' } }
});

test('reviews: validated, one per reader, sync library rating, first one goes to the feed', async () => {
  assert.strictEqual((await review('bo', '111', 6, 'x')).status, 400);
  assert.strictEqual((await review('bo', '111', 3, 'y'.repeat(2001))).status, 400);

  await addBook('bo', '111');
  const first = await review('bo', '111', 4, '  Strange and lovely.  ');
  assert.strictEqual(first.status, 200);
  assert.strictEqual(first.body.review.text, 'Strange and lovely.');
  const lib = (await call(library, 'GET', '/library/bo/books', { caller: 'bo', pathParameters: { userId: 'bo' } })).body.books[0];
  assert.strictEqual(lib.rating, 4, 'library rating follows the review');

  await review('bo', '111', 5, 'Changed my mind: a masterpiece.');
  const notInLibrary = await review('bo', '999', 3, 'Borrowed it.');
  assert.strictEqual(notInLibrary.status, 200);
  assert.strictEqual(db.table('pagebound-library').has('bo|999'), false, 'reviewing does not add the book');

  const feed = (await feedOf('ann')).items.filter(i => i.type === 'book_reviewed');
  assert.deepStrictEqual(feed.map(i => `${i.book.isbn}:${i.review.rating}`).sort(), ['111:4', '999:3'], 'edits do not post again');

  const all = await reviewsOf('ann', '111');
  assert.strictEqual(all.count, 1);
  assert.strictEqual(all.average, 5);
  assert.strictEqual(all.reviews[0].text, 'Changed my mind: a masterpiece.');
  assert.strictEqual(all.reviews[0].author.displayName, 'Bo');
  assert.strictEqual(all.mine, null);
  assert.strictEqual((await reviewsOf('bo', '111')).mine.rating, 5);
});

test('reviews: private profiles are anonymous; profile lists are friends-only', async () => {
  await review('bo', '111', 4, 'Good.');
  await review('cy', '111', 2, 'Not for me.');
  db.table('pagebound-users').get('cy@test').isPrivate = true;

  const list = await reviewsOf('ann', '111');
  assert.deepStrictEqual(list.reviews.map(r => r.author.displayName).sort(), ['A Pagebound reader', 'Bo']);
  assert.ok(list.reviews.every(r => r.author.userId !== 'cy'), 'no id for anonymous reviewers');
  assert.strictEqual((await reviewsOf('cy', '111')).mine.author.displayName, 'Cy', 'you always see yourself');

  const byBo = (who) => call(social, 'GET', '/reviews/by/bo', { caller: who, pathParameters: { userId: 'bo' } });
  assert.strictEqual((await byBo('ann')).body.reviews.length, 1);
  assert.strictEqual((await byBo('cy')).status, 403);
  db.table('pagebound-users').get('bo@test').isPrivate = true;
  assert.deepStrictEqual((await byBo('ann')).body, { isPrivate: true, reviews: [] });
  assert.strictEqual((await byBo('bo')).body.reviews.length, 1, 'your own list is always visible');

  const del = await call(social, 'DELETE', '/books/111/reviews/mine', { caller: 'bo', pathParameters: { isbn: '111' } });
  assert.strictEqual(del.status, 200);
  assert.strictEqual((await reviewsOf('ann', '111')).count, 1);
});

// ---------------------------------------------------------------- profile
const userCall = (method, who, proxy, body) =>
  call(userApi, method, `/users/${proxy}`, { caller: who, pathParameters: { proxy }, body });

test('profile: edit own tagline / favorites / privacy only; validated', async () => {
  const ok = await userCall('PUT', 'ann', 'ann@test/profile', {
    tagline: '  Reading slowly.  ', isPrivate: true,
    favoriteBooks: [{ isbn: '1', title: 'Circe', author: 'Miller', shelf: 'x', extra: 'y' }, { title: 'no isbn' }]
  });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(ok.body.profile.tagline, 'Reading slowly.');
  assert.strictEqual(ok.body.profile.isPrivate, true);
  assert.deepStrictEqual(ok.body.profile.favoriteBooks, [{ isbn: '1', title: 'Circe', author: 'Miller', coverUrl: null }]);

  assert.strictEqual((await userCall('PUT', 'bo', 'ann@test/profile', { tagline: 'hacked' })).status, 403);
  assert.strictEqual((await userCall('PUT', 'ann', 'ann@test/profile', { tagline: 'x'.repeat(256) })).status, 400);
  assert.strictEqual((await userCall('PUT', 'ann', 'ann@test/profile', { favoriteBooks: new Array(11).fill({ isbn: '1', title: 't' }) })).status, 400);
  assert.strictEqual((await userCall('PUT', 'ann', 'ann@test/profile', {})).status, 400);
});

test('profile: stats from the real library and friends', async () => {
  await addBook('ann', '1', { shelf: 'Finished', totalChapters: 10 });
  await addBook('ann', '2', { shelf: 'Currently Reading' });
  const stats = await userCall('GET', 'ann', 'ann@test/stats');
  assert.strictEqual(stats.status, 200);
  assert.deepStrictEqual(
    { ...stats.body, joinedDate: undefined },
    { totalBooks: 2, booksRead: 1, currentlyReading: 1, chaptersCompleted: 10, friendsCount: 1, joinedDate: undefined }
  );
  assert.strictEqual((await userCall('GET', 'bo', 'ann@test/stats')).status, 403);
});

test('avatar: real images only, size-capped, own only; replaces the old file', async () => {
  const png = 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]).toString('base64');
  const jpeg = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]).toString('base64');
  const fake = 'data:image/png;base64,' + Buffer.from('<svg onload=alert(1)>').toString('base64');

  assert.strictEqual((await userCall('POST', 'ann', 'ann@test/avatar', { imageData: fake })).status, 400, 'content is checked, not the label');
  assert.strictEqual((await userCall('POST', 'ann', 'ann@test/avatar', { imageData: 'https://evil.example/x.png' })).status, 400);
  const big = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(1024 * 1024)]).toString('base64');
  assert.strictEqual((await userCall('POST', 'ann', 'ann@test/avatar', { imageData: big })).status, 400);
  assert.strictEqual((await userCall('POST', 'bo', 'ann@test/avatar', { imageData: png })).status, 403);
  db.table('pagebound-users').set('ghost@test', { email: 'ghost@test' });
  const ghost = await call(userApi, 'POST', '/users/ghost@test/avatar', {
    caller: 'ghost', pathParameters: { proxy: 'ghost@test/avatar' }, body: { imageData: png }
  });
  assert.strictEqual(ghost.status, 404, 'no userId: clean error, not a crash');
  assert.strictEqual(ghost.headers['Access-Control-Allow-Origin'], '*');

  const first = await userCall('POST', 'ann', 'ann@test/avatar', { imageData: png });
  assert.strictEqual(first.status, 200);
  assert.ok(first.body.avatarUrl.startsWith('https://test-avatars.s3.'), first.body.avatarUrl);
  assert.ok(first.body.avatarUrl.includes('/avatars/ann/') && first.body.avatarUrl.endsWith('.png'));
  assert.strictEqual(db.s3Objects.size, 1);

  await new Promise(r => setTimeout(r, 5));
  const second = await userCall('POST', 'ann', 'ann@test/avatar', { imageData: jpeg });
  assert.ok(second.body.avatarUrl.endsWith('.jpg'));
  assert.strictEqual(db.s3Objects.size, 1, 'the old photo is removed');
  assert.strictEqual(db.table('pagebound-users').get('ann@test').avatarUrl, second.body.avatarUrl);
});

test('friend library includes their public profile bits', async () => {
  db.table('pagebound-users').get('bo@test').tagline = 'Hi';
  db.table('pagebound-users').get('bo@test').favoriteBooks = [{ isbn: '1', title: 'Circe' }];
  const r = await call(library, 'GET', '/library/bo/public', { caller: 'ann', pathParameters: { userId: 'bo' } });
  assert.deepStrictEqual(r.body.profile, { tagline: 'Hi', favoriteBooks: [{ isbn: '1', title: 'Circe' }] });
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
