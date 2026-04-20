const { getSession } = require('../bot/sessionManager');

async function broadcast(req, res) {
  const sessionId = req.cookies?.df_session;
  if (!sessionId) return res.status(400).json({ error: 'No session cookie' });

  const session = getSession(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.state.status !== 'ready') return res.status(400).json({ error: 'WhatsApp not connected' });

  const { messages, groups } = req.body;
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'No messages provided' });
  if (!Array.isArray(groups) || !groups.length) return res.status(400).json({ error: 'No groups selected' });

  const valid = messages.filter(m => m.text?.trim() || m.media?.data);
  if (!valid.length) return res.status(400).json({ error: 'Each message needs text or media' });

  const job = session.queue.add({ messages: valid, groups });
  res.json({ status: 'queued', jobId: job.id, messageCount: valid.length, groupCount: groups.length });
}

module.exports = { broadcast };
