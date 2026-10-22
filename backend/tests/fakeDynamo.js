// In-memory stand-in for DynamoDBDocumentClient.send, covering only the
// expression shapes the Pagebound Lambdas use. Lets handler tests run offline
// without touching real tables.
const path = require('path');

// Patch the exact SDK copy the Lambdas load (backend/lambda/node_modules if present)
const lib = require(require.resolve('@aws-sdk/lib-dynamodb', { paths: [path.join(__dirname, '../lambda')] }));

const KEYS = {
  'pagebound-sessions': ['sessionId'],
  'pagebound-session-members': ['userId', 'sessionId'],
  'pagebound-messages': ['messageId'],
  'pagebound-friends': ['userId', 'friendUserId'],
  'pagebound-users': ['email'],
  'pagebound-library': ['userId', 'isbn'],
  'pagebound-shelves': ['userId', 'shelfId'],
  'pagebound-activity': ['actorId', 'sk'],
  'pagebound-recommendations': ['toUserId', 'sk'],
  'pagebound-reactions': ['itemId', 'userId']
};

const tables = {};
const table = (name) => (tables[name] = tables[name] || new Map());
const keyOf = (name, item) => KEYS[name].map(k => item[k]).join('|');
const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

function resolve(token, names = {}, values = {}) {
  token = token.trim();
  if (token.startsWith(':')) return values[token];
  return token.split('.').map(part => names[part] || part);
}

function matches(item, expr, names, values) {
  if (!expr) return true;
  return expr.split(/\s+AND\s+/i).every(cond => {
    const m = cond.match(/^\s*(.+?)\s*(=|>)\s*(.+?)\s*$/);
    const [attr] = resolve(m[1], names, values);
    const value = resolve(m[3], names, values);
    return m[2] === '>' ? item[attr] > value : item[attr] === value;
  });
}

function applySet(item, expr, names, values) {
  expr.replace(/^SET\s+/i, '').split(/,\s*/).forEach(assign => {
    const [lhs, rhs] = assign.split('=').map(s => s.trim());
    const path = resolve(lhs, names, values);
    const value = clone(resolve(rhs, names, values));
    let target = item;
    path.slice(0, -1).forEach(p => { target[p] = target[p] || {}; target = target[p]; });
    target[path[path.length - 1]] = value;
  });
}

async function send(command) {
  const input = command.input;
  const name = input.TableName;
  const t = name && table(name);

  if (command instanceof lib.GetCommand) {
    return { Item: clone(t.get(keyOf(name, input.Key))) };
  }
  if (command instanceof lib.PutCommand) {
    const k = keyOf(name, input.Item);
    if (input.ConditionExpression?.startsWith('attribute_not_exists') && t.has(k)) {
      const e = new Error('Conditional check failed');
      e.name = 'ConditionalCheckFailedException';
      throw e;
    }
    t.set(k, clone(input.Item));
    return {};
  }
  if (command instanceof lib.DeleteCommand) {
    t.delete(keyOf(name, input.Key));
    return {};
  }
  if (command instanceof lib.UpdateCommand) {
    const k = keyOf(name, input.Key);
    const item = t.get(k) || clone(input.Key);
    applySet(item, input.UpdateExpression, input.ExpressionAttributeNames, input.ExpressionAttributeValues);
    t.set(k, item);
    return { Attributes: clone(item) };
  }
  if (command instanceof lib.QueryCommand) {
    let items = [...t.values()].filter(i =>
      matches(i, input.KeyConditionExpression, input.ExpressionAttributeNames, input.ExpressionAttributeValues) &&
      matches(i, input.FilterExpression, input.ExpressionAttributeNames, input.ExpressionAttributeValues));
    // Range-key order (sk / sessionId / ...), newest first when asked
    const rangeKey = KEYS[name][1];
    if (rangeKey) items.sort((a, b) => String(a[rangeKey]).localeCompare(String(b[rangeKey])));
    if (input.ScanIndexForward === false) items.reverse();
    if (input.Limit) items = items.slice(0, input.Limit);
    return { Items: clone(items), Count: items.length };
  }
  if (command instanceof lib.BatchWriteCommand) {
    Object.entries(input.RequestItems).forEach(([tableName, requests]) => {
      requests.forEach(r => {
        if (r.PutRequest) table(tableName).set(keyOf(tableName, r.PutRequest.Item), clone(r.PutRequest.Item));
        if (r.DeleteRequest) table(tableName).delete(keyOf(tableName, r.DeleteRequest.Key));
      });
    });
    return {};
  }
  throw new Error(`fakeDynamo: unsupported command ${command.constructor.name}`);
}

lib.DynamoDBDocumentClient.prototype.send = send;
// The Lambdas call DynamoDBDocumentClient.from(client) – make it return a stub
lib.DynamoDBDocumentClient.from = () => ({ send });

module.exports = { tables, table, reset: () => Object.keys(tables).forEach(k => delete tables[k]) };
