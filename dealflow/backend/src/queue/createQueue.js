const { MessageMedia } = require('whatsapp-web.js');
const { randomDelay, sendWithRetry, RateLimiter } = require('../utils/antiBan');
const io = require('../utils/io');

/**
 * Sending strategy — fully sequential, one send at a time.
 *
 * All (group × message) combinations are flattened into a single ordered list
 * and processed one after another with a random delay between each.
 *
 * Why not parallel?
 * Parallel sends across groups fire simultaneously before any delay can run,
 * causing a burst that WhatsApp detects as spam → "waiting for this message".
 *
 * Order: group1-msg1 → group2-msg1 → group3-msg1 → group1-msg2 → ...
 * (round-robin across groups so every group gets msg1 before any gets msg2)
 */
function createQueue(sessionId) {
  let whatsappClient = null;
  const limiter = new RateLimiter(Number(process.env.MAX_PER_MINUTE) || 20);
  let jobId = 0;
  let busy = false;
  const queue = [];

  function log(data) {
    const entry = { ...data, timestamp: new Date().toISOString() };
    console.log(`[${sessionId}] ${entry.status} → ${entry.group}: ${entry.label ?? ''}`);
    io.emitToSession(sessionId, 'log', entry);
  }

  async function sendOne(groupId, message) {
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

  /**
   * Build a round-robin task list so sends are interleaved across groups.
   *
   * groups = [A, B, C], messages = [m1, m2]
   * Result: A-m1, B-m1, C-m1, A-m2, B-m2, C-m2
   *
   * This means no group receives msg2 before every group has received msg1,
   * giving WhatsApp time to settle between bursts to the same recipient.
   */
  function buildTasks(groups, messages) {
    const tasks = [];
    for (const message of messages) {
      for (const groupId of groups) {
        tasks.push({ groupId, message });
      }
    }
    return tasks;
  }

  async function processNext() {
    if (busy || queue.length === 0) return;
    busy = true;

    const job = queue.shift();
    const { messages, groups } = job.data;
    const tasks = buildTasks(groups, messages);

    console.log(`[${sessionId}] Job ${job.id} — ${tasks.length} send(s) queued sequentially`);

    try {
      for (const { groupId, message } of tasks) {
        // Block if we've hit the per-minute cap
        await limiter.throttle();

        try {
          const label = await sendOne(groupId, message);
          log({ group: groupId, label, status: 'sent' });
        } catch (err) {
          log({
            group: groupId,
            label: message.text?.slice(0, 30) ?? '[media]',
            status: 'failed',
            error: err.message,
          });
        }

        // Always wait before the next send — this is what prevents the burst
        await randomDelay();
      }

      io.emitToSession(sessionId, 'log', {
        status: 'done',
        jobId: job.id,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      io.emitToSession(sessionId, 'log', {
        status: 'job_failed',
        jobId: job.id,
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    } finally {
      busy = false;
      processNext();
    }
  }

  return {
    init(client) { whatsappClient = client; },
    add(data) {
      const id = String(++jobId);
      queue.push({ id, data });
      processNext();
      return { id };
    },
  };
}

module.exports = createQueue;
