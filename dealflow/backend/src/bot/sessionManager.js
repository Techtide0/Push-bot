const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const io = require('../utils/io');
const createQueue = require('../queue/createQueue');

// ─── persistence ──────────────────────────────────────────────────────────────

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week
const STORE_PATH = path.join(__dirname, '../../data/sessions.json');

function readStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return [];
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function writeStore(records) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(records, null, 2));
}

function touchSession(sessionId) {
  const records = readStore().filter(r => r.sessionId !== sessionId);
  records.push({ sessionId, lastSeen: Date.now() });
  writeStore(records);
}

function removeFromStore(sessionId) {
  writeStore(readStore().filter(r => r.sessionId !== sessionId));
}

function liveSessionIds() {
  const now = Date.now();
  return readStore()
    .filter(r => now - r.lastSeen < SESSION_TTL_MS)
    .map(r => r.sessionId);
}

// ─── in-memory map ─────────────────────────────────────────────────────────
const sessions = new Map(); // sessionId → { client, state, queue }

function makeState() {
  return { status: 'idle', qrDataUrl: null };
}

function getSessionState(sessionId) {
  const s = sessions.get(sessionId);
  return s ? { ...s.state } : null;
}

function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

// ─── session lifecycle ────────────────────────────────────────────────────────

function createSession(sessionId) {
  if (sessions.has(sessionId)) return sessions.get(sessionId);

  const state = makeState();
  const queue = createQueue(sessionId);

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: sessionId }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  client.on('qr', async (qr) => {
    state.qrDataUrl = await QRCode.toDataURL(qr);
    state.status = 'qr';
    io.emitToSession(sessionId, 'wa_status', { ...state });
    console.log(`[${sessionId}] QR ready`);
  });

  client.on('authenticated', () => {
    state.status = 'authenticated';
    state.qrDataUrl = null;
    touchSession(sessionId); // refresh the 1-week TTL
    io.emitToSession(sessionId, 'wa_status', { ...state });
    console.log(`[${sessionId}] Authenticated`);
  });

  client.on('ready', () => {
    state.status = 'ready';
    state.qrDataUrl = null;
    queue.init(client);
    touchSession(sessionId);
    io.emitToSession(sessionId, 'wa_status', { ...state });
    console.log(`[${sessionId}] Ready`);
  });

  client.on('auth_failure', () => {
    state.status = 'idle';
    state.qrDataUrl = null;
    removeFromStore(sessionId); // auth gone — don't auto-restore next boot
    io.emitToSession(sessionId, 'wa_status', { ...state });
    console.error(`[${sessionId}] Auth failed — removed from store`);
  });

  client.on('disconnected', (reason) => {
    state.status = 'disconnected';
    state.qrDataUrl = null;
    io.emitToSession(sessionId, 'wa_status', { ...state });
    console.warn(`[${sessionId}] Disconnected: ${reason}`);
  });

  sessions.set(sessionId, { client, state, queue });
  return sessions.get(sessionId);
}

function startSession(sessionId) {
  const session = createSession(sessionId);
  if (session.state.status === 'idle' || session.state.status === 'disconnected') {
    session.state.status = 'initializing';
    io.emitToSession(sessionId, 'wa_status', { ...session.state });
    session.client.initialize();
  }
  return session;
}

// ─── boot restore ─────────────────────────────────────────────────────────────

/**
 * Called once at startup.
 * Re-initialises every session that was active within the last week.
 * LocalAuth has the credentials on disk — no QR needed in most cases.
 */
function restorePersistedSessions() {
  const ids = liveSessionIds();
  if (ids.length === 0) return;
  console.log(`🔄 Restoring ${ids.length} persisted session(s)…`);
  for (const sessionId of ids) {
    startSession(sessionId);
  }
}

// ─── public ───────────────────────────────────────────────────────────────────

function generateSessionId() {
  return crypto.randomBytes(12).toString('hex');
}

module.exports = {
  createSession,
  startSession,
  getSession,
  getSessionState,
  generateSessionId,
  restorePersistedSessions,
};
