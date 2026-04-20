const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const io = require('../utils/io');

const state = {
  status: 'idle', // 'idle' | 'initializing' | 'qr' | 'authenticated' | 'ready' | 'disconnected'
  qrDataUrl: null,
};

function getState() { return { ...state }; }

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

client.on('qr', async (qr) => {
  state.qrDataUrl = await QRCode.toDataURL(qr);
  state.status = 'qr';
  io.emit('wa_status', getState());
  console.log('📱 QR ready — sent to frontend');
});

client.on('authenticated', () => {
  state.status = 'authenticated';
  state.qrDataUrl = null;
  io.emit('wa_status', getState());
  console.log('🔐 Authenticated');
});

client.on('ready', () => {
  state.status = 'ready';
  state.qrDataUrl = null;
  io.emit('wa_status', getState());
  console.log('✅ WhatsApp ready');
});

client.on('auth_failure', () => {
  state.status = 'idle';
  state.qrDataUrl = null;
  initialized = false;
  io.emit('wa_status', getState());
  console.error('❌ Auth failed');
});

client.on('disconnected', () => {
  state.status = 'disconnected';
  state.qrDataUrl = null;
  initialized = false;
  io.emit('wa_status', getState());
  console.warn('⚠️  Disconnected');
});

// Guard so initialize() is never called twice
let initialized = false;

function startSession() {
  if (initialized) return;
  initialized = true;
  state.status = 'initializing';
  io.emit('wa_status', getState());
  client.initialize();
  console.log('🔄 Session starting…');
}

module.exports = { client, getState, startSession };
