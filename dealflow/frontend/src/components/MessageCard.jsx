import { useRef } from 'react';

const ACCEPTED = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/3gpp';
const MAX_BYTES = 60 * 1024 * 1024; // 60 MB

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // reader.result is "data:<mime>;base64,<data>" — strip the prefix
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function MessageCard({ index, message, onChange, onRemove, total }) {
  const fileInputRef = useRef();

  async function handleFileChange(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > MAX_BYTES) {
      onChange({ ...message, mediaError: `File too large (max 60 MB)` });
      return;
    }

    onChange({ ...message, mediaLoading: true, mediaError: null });
    try {
      const data = await fileToBase64(file);
      onChange({
        ...message,
        media: { data, mimetype: file.type, filename: file.name },
        mediaPreview: URL.createObjectURL(file),
        mediaLoading: false,
        mediaError: null,
      });
    } catch {
      onChange({ ...message, mediaLoading: false, mediaError: 'Failed to read file' });
    }
  }

  function removeMedia() {
    if (message.mediaPreview) URL.revokeObjectURL(message.mediaPreview);
    onChange({ ...message, media: null, mediaPreview: null, mediaError: null });
  }

  const isVideo = message.media?.mimetype?.startsWith('video');

  return (
    <div className="message-card">
      <div className="card-header">
        <span className="card-label">Message {index + 1}</span>
        {total > 1 && (
          <button className="card-remove" onClick={onRemove}>✕ Remove</button>
        )}
      </div>

      {/* Media preview / picker */}
      <div className="media-zone">
        {message.mediaPreview ? (
          <div className="media-preview">
            {isVideo
              ? <video src={message.mediaPreview} controls className="preview-asset" />
              : <img src={message.mediaPreview} alt="preview" className="preview-asset" />
            }
            <button className="remove-media-btn" onClick={removeMedia}>✕</button>
          </div>
        ) : (
          <button
            className="pick-media-btn"
            onClick={() => fileInputRef.current.click()}
            disabled={message.mediaLoading}
          >
            {message.mediaLoading ? 'Reading file…' : '+ Add Image / Video'}
          </button>
        )}
        {message.mediaError && <p className="media-error">{message.mediaError}</p>}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED}
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      {/* Text / caption */}
      <textarea
        className="card-text"
        placeholder={message.media ? 'Caption (optional)' : 'Product description, price, details…'}
        value={message.text}
        onChange={e => onChange({ ...message, text: e.target.value })}
        rows={3}
      />
    </div>
  );
}
