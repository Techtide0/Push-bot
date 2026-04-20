const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');

function storePath(sessionId) {
  return path.join(DATA_DIR, `groups-${sessionId}.json`);
}

function ensureStore(sessionId) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const p = storePath(sessionId);
  if (!fs.existsSync(p)) fs.writeFileSync(p, '[]');
}

function getSelected(sessionId) {
  ensureStore(sessionId);
  return JSON.parse(fs.readFileSync(storePath(sessionId), 'utf8'));
}

function saveSelected(sessionId, groups) {
  ensureStore(sessionId);
  fs.writeFileSync(storePath(sessionId), JSON.stringify(groups, null, 2));
}

function addGroup(sessionId, group) {
  const groups = getSelected(sessionId);
  if (groups.find(g => g.id === group.id)) return groups;
  const updated = [...groups, group];
  saveSelected(sessionId, updated);
  return updated;
}

function removeGroup(sessionId, groupId) {
  const updated = getSelected(sessionId).filter(g => g.id !== groupId);
  saveSelected(sessionId, updated);
  return updated;
}

module.exports = { getSelected, addGroup, removeGroup };
