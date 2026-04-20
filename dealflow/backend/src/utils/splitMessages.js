/**
 * Splits a multi-line string of deals into a clean array of messages.
 * Each non-empty line becomes one message.
 *
 * Input:
 *   "iPhone 13 - ₦350k\n\nSamsung S22 - ₦280k"
 *
 * Output:
 *   ["iPhone 13 - ₦350k", "Samsung S22 - ₦280k"]
 */
function splitMessages(text) {
  if (typeof text !== 'string') return [];
  return text
    .split('\n')
    .map(m => m.trim())
    .filter(Boolean);
}

module.exports = splitMessages;
