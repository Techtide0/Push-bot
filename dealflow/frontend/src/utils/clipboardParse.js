/**
 * Parse a ClipboardEvent into { text, media }
 *
 * text  → string (may be empty)
 * media → { data: base64, mimetype, filename, previewUrl } | null
 */
export async function parseClipboard(e) {
  const items = Array.from(e.clipboardData?.items ?? []);

  // ── text ──────────────────────────────────────────────────────────────────
  const textItem = items.find(i => i.kind === 'string' && i.type === 'text/plain');
  const text = textItem
    ? await new Promise(res => textItem.getAsString(res))
    : '';

  // ── image / video ─────────────────────────────────────────────────────────
  const mediaItem = items.find(
    i => i.kind === 'file' && (i.type.startsWith('image/') || i.type.startsWith('video/'))
  );

  let media = null;
  if (mediaItem) {
    const file = mediaItem.getAsFile();
    const base64 = await fileToBase64(file);
    media = {
      data: base64,
      mimetype: file.type,
      filename: file.name || `paste-${Date.now()}.${file.type.split('/')[1]}`,
      previewUrl: URL.createObjectURL(file),
    };
  }

  return { text: text.trim(), media };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
