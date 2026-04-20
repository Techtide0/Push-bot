const { getSession } = require('../bot/sessionManager');
const store = require('../services/groupStore');

function sid(req) { return req.cookies?.df_session; }

function requireSession(req, res) {
  const sessionId = sid(req);
  if (!sessionId) { res.status(400).json({ error: 'No session cookie' }); return null; }
  const session = getSession(sessionId);
  if (!session) { res.status(404).json({ error: 'Session not found' }); return null; }
  if (session.state.status !== 'ready') { res.status(400).json({ error: 'WhatsApp not connected' }); return null; }
  return { sessionId, session };
}

async function getAvailableGroups(req, res) {
  const s = requireSession(req, res);
  if (!s) return;
  try {
    const chats = await s.session.client.getChats();
    const groups = chats.filter(c => c.isGroup).map(g => ({ id: g.id._serialized, name: g.name }));
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch groups', detail: err.message });
  }
}

function getSelectedGroups(req, res) {
  const sessionId = sid(req);
  if (!sessionId) return res.status(400).json({ error: 'No session cookie' });
  res.json(store.getSelected(sessionId));
}

function addGroup(req, res) {
  const sessionId = sid(req);
  if (!sessionId) return res.status(400).json({ error: 'No session cookie' });
  const { id, name } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'id and name required' });
  res.json(store.addGroup(sessionId, { id, name }));
}

function removeGroup(req, res) {
  const sessionId = sid(req);
  if (!sessionId) return res.status(400).json({ error: 'No session cookie' });
  res.json(store.removeGroup(sessionId, decodeURIComponent(req.params.id)));
}

module.exports = { getAvailableGroups, getSelectedGroups, addGroup, removeGroup };
