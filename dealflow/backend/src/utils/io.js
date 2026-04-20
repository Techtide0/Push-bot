const cookie = require('cookie');
let _io = null;

function init(httpServer, cookieName) {
  const { Server } = require('socket.io');
  _io = new Server(httpServer, {
    cors: { origin: true, credentials: true },
  });

  _io.on('connection', (socket) => {
    // Read sessionId straight from the handshake cookie — no client event needed
    const cookies = cookie.parse(socket.handshake.headers.cookie || '');
    const sessionId = cookies[cookieName];

    if (!sessionId) {
      socket.emit('wa_status', { status: 'not_found' });
      return;
    }

    socket.join(sessionId);
    console.log(`🖥️  Socket ${socket.id} joined session ${sessionId}`);

    const { getSessionState } = require('../bot/sessionManager');
    const state = getSessionState(sessionId);
    socket.emit('wa_status', state ?? { status: 'not_found' });

    socket.on('disconnect', () => {
      console.log(`🖥️  Socket ${socket.id} disconnected`);
    });
  });

  return _io;
}

function emitToSession(sessionId, event, data) {
  if (_io) _io.to(sessionId).emit(event, data);
}

function emit(event, data) {
  if (_io) _io.emit(event, data);
}

module.exports = { init, emit, emitToSession };
