import { useRef, useState } from 'react';
import { parseClipboard } from '../utils/clipboardParse';

export default function PasteZone({ onPaste }) {
  const ref = useRef();
  const [state, setState] = useState('idle'); // 'idle' | 'focused' | 'processing' | 'done' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  async function handlePaste(e) {
    e.preventDefault();
    setState('processing');

    try {
      const { text, media } = await parseClipboard(e);

      if (!text && !media) {
        setErrorMsg('Nothing detected in clipboard — copy a WhatsApp message first.');
        setState('error');
        return;
      }

      onPaste({ text, media });
      setState('done');
      setTimeout(() => setState('idle'), 2000);
    } catch (err) {
      setErrorMsg('Could not read clipboard: ' + err.message);
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  }

  const label = {
    idle:       '📋  Click here, then paste  (Ctrl+V)',
    focused:    '✋  Ready — press Ctrl+V to paste',
    processing: '⏳  Reading clipboard…',
    done:       '✅  Message card created!',
    error:      `❌  ${errorMsg}`,
  }[state];

  return (
    <div
      ref={ref}
      tabIndex={0}
      className={`paste-zone ${state}`}
      onFocus={() => state === 'idle' && setState('focused')}
      onBlur={() => state === 'focused' && setState('idle')}
      onPaste={handlePaste}
      onClick={() => ref.current.focus()}
      role="button"
      aria-label="Paste WhatsApp message"
    >
      {label}
    </div>
  );
}
