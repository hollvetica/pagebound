// How a new reader's profile starts. Shared by the sign-up trigger
// (createUserProfile.js) and the user API's safety net (userAPI.live.js), so
// a profile looks the same whichever one creates it.
//
// Packaged next to each function's index.js (see backend/scripts/zip_lambda).
//
//   - Profiles are keyed by lowercase email.
//   - A profile is only ever created, never overwritten.
//   - Usernames are unique ignoring case. The reader's choice is used when
//     it's free (with a number added if it isn't); with no choice, a neutral
//     "reader1234" handle, never part of the email address.
const { GetCommand, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const SUPER_ADMIN_EMAIL = 'hollie.tanner@gmail.com';
const USERNAME_MIN = 3;
const USERNAME_MAX = 24;
const USERNAME_RULE = `Usernames are ${USERNAME_MIN}–${USERNAME_MAX} letters, numbers, dots or underscores.`;

const emailKey = (email) => String(email || '').trim().toLowerCase();

// Spaces become underscores; anything else outside the allowed set is dropped
function cleanUsername(raw) {
  const name = String(raw || '').trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9._]/g, '').slice(0, USERNAME_MAX);
  return name.length >= USERNAME_MIN ? name : null;
}

// Every username in use (lowercase), optionally ignoring one account's own.
// A scan is fine at beta scale; move to a lowercase-username index past a few
// thousand readers.
async function usernamesInUse(dynamodb, table, exceptEmail) {
  const taken = new Set();
  const except = emailKey(exceptEmail);
  let ExclusiveStartKey;
  do {
    const page = await dynamodb.send(new ScanCommand({
      TableName: table,
      ProjectionExpression: '#e, #u',
      ExpressionAttributeNames: { '#e': 'email', '#u': 'username' },
      ExclusiveStartKey
    }));
    (page.Items || []).forEach(i => {
      if (i.username && emailKey(i.email) !== except) taken.add(String(i.username).toLowerCase());
    });
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return taken;
}

async function isUsernameTaken(dynamodb, table, username, exceptEmail) {
  return (await usernamesInUse(dynamodb, table, exceptEmail)).has(String(username).toLowerCase());
}

function pickUsername(wanted, taken) {
  const free = (name) => !taken.has(name.toLowerCase());
  const base = cleanUsername(wanted);
  if (base) {
    if (free(base)) return base;
    for (let n = 2; n < 1000; n++) {
      const candidate = `${base.slice(0, USERNAME_MAX - String(n).length)}${n}`;
      if (free(candidate)) return candidate;
    }
  }
  for (let i = 0; i < 50; i++) {
    const candidate = `reader${1000 + Math.floor(Math.random() * 9000)}`;
    if (free(candidate)) return candidate;
  }
  return `reader${Date.now()}`;
}

// Returns { profile, created }. Safe to call any number of times.
async function createProfileIfMissing(dynamodb, { table, email, userId, wantedUsername }) {
  const key = emailKey(email);
  if (!key || !userId) throw new Error('createProfileIfMissing needs an email and a userId');

  const existing = (await dynamodb.send(new GetCommand({ TableName: table, Key: { email: key } }))).Item;
  if (existing) return { profile: existing, created: false };

  const username = pickUsername(wantedUsername, await usernamesInUse(dynamodb, table));
  const profile = {
    email: key,
    userId,
    username,
    displayName: username,
    bio: '',
    avatarUrl: null,
    isPrivate: false,
    isAdmin: key === SUPER_ADMIN_EMAIL,
    createdAt: new Date().toISOString(),
    friendsCount: 0,
    publicShelves: []
  };

  try {
    await dynamodb.send(new PutCommand({
      TableName: table,
      Item: profile,
      ConditionExpression: 'attribute_not_exists(email)'
    }));
    return { profile, created: true };
  } catch (error) {
    // Created by the other path a moment ago: keep that one
    if (error.name !== 'ConditionalCheckFailedException') throw error;
    const winner = (await dynamodb.send(new GetCommand({ TableName: table, Key: { email: key } }))).Item;
    return { profile: winner, created: false };
  }
}

module.exports = {
  USERNAME_RULE,
  emailKey,
  cleanUsername,
  isUsernameTaken,
  pickUsername,
  createProfileIfMissing
};
