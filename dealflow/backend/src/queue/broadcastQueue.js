/**
 * In-memory job queue — no Redis, no file storage.
 *
 * Each message in a job is:
 *   { text: string, media?: { data: string (base64), mimetype: string, filename: string } }
 *
 * If media is present → send as image/video with text as caption.
 * If text only        → send as plain text.
 *
 * Groups run in parallel, sharing one rate limiter.
 */

const { MessageMedia } = require('whatsapp-web.js');
const { randomDelay, sendWithRetry, RateLimiter } = require('../utils/antiBan');
const io = require('../utils/io');

let whatsappClient = null;
const limiter = new RateLimiter(Number(process.env.MAX_PER_MINUTE) || 20);

let jobId = 0;
let busy = false;
const queue = [];

function log(data) {
  const entry = { ...data, timestamp: new Date().toISOString() };
  console.log(`[${entry.timestamp}] ${entry.status} → ${entry.group}: ${entry.label}`);
  io.emit('log', entry);
}

async function sendMessage(groupId, message) {
  const { text = '', media } = message;

  if (media?.data) {
    const mediaObj = new MessageMedia(media.mimetype, media.data, media.filename);
    await sendWithRetry(
      () => whatsappClient.sendMessage(groupId, mediaObj, { caption: text }),
      `media → ${groupId}`
    );
    return `[${media.mimetype.split('/')[0]}] ${text ? `"${text.slice(0, 30)}"` : media.filename}`;
  }

  await sendWithRetry(
    () => whatsappClient.sendMessage(groupId, text),
    `text → ${groupId}`
  );
  return text.slice(0, 40);
}

async function sendToGroup(groupId, messages) {
  for (const message of messages) {
    await limiter.throttle();
    try {
      const label = await sendMessage(groupId, message);
      log({ group: groupId, label, status: 'sent' });
    } catch (err) {
      log({ group: groupId, label: message.text?.slice(0, 30) ?? '[media]', status: 'failed', error: err.message });
    }
    await randomDelay();
  }
}

async function processNext() {
  if (busy || queue.length === 0) return;
  busy = true;

  const job = queue.shift();
  const { messages, groups } = job.data;
  console.log(`▶️  Job ${job.id} — ${messages.length} message(s) → ${groups.length} group(s)`);

  try {
    await Promise.all(groups.map(groupId => sendToGroup(groupId, messages)));
    console.log(`✅ Job ${job.id} done`);
    io.emit('log', { status: 'done', jobId: job.id, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error(`❌ Job ${job.id} error:`, err.message);
    io.emit('log', { status: 'job_failed', jobId: job.id, error: err.message, timestamp: new Date().toISOString() });
  } finally {
    busy = false;
    processNext();
  }
}

function add(data) {
  const id = String(++jobId);
  queue.push({ id, data });
  console.log(`📨 Job ${id} queued (depth: ${queue.length})`);
  processNext();
  return { id };
}

function init(client) {
  whatsappClient = client;
}

module.exports = { add, init };
