require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const io = require('./src/utils/io');
const {
  generateSessionId, startSession, getSessionState, restorePersistedSessions,
} = require('./src/bot/sessionManager');

const app = express();
const server = http.createServer(app);

const COOKIE_NAME = 'df_session';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

io.init(server, COOKIE_NAME);

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '100mb' }));

// ── session routes ─────────────────────────────────────────────────────────

app.post('/session/create', (req, res) => {
  // Reuse existing cookie if the session is still alive
  const existing = req.cookies[COOKIE_NAME];
  const sessionId = (existing && getSessionState(existing)) ? existing : generateSessionId();

  res.cookie(COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
  });
  res.json({ ok: true });
});

app.post('/session/start', (req, res) => {
  const sessionId = req.cookies[COOKIE_NAME];
  if (!sessionId) return res.status(400).json({ error: 'No session cookie' });
  startSession(sessionId);
  res.json(getSessionState(sessionId));
});

app.get('/session/status', (req, res) => {
  const sessionId = req.cookies[COOKIE_NAME];
  if (!sessionId) return res.status(404).json({ error: 'No session cookie' });
  const state = getSessionState(sessionId);
  if (!state) return res.status(404).json({ error: 'Session not found' });
  res.json(state);
});

// ── feature routes ─────────────────────────────────────────────────────────
app.use('/groups',    require('./src/routes/groups'));
app.use('/broadcast', require('./src/routes/broadcast'));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  restorePersistedSessions();
});
