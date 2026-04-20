import { useState } from 'react';
import { apiFetch } from '../api';

export default function SessionView({ waStatus, onSessionReady }) {
  const { status, qrDataUrl } = waStatus;
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setLoading(true);
    try {
      // Set the session cookie
      await apiFetch('/session/create', { method: 'POST' });
      // Reconnect socket so it re-handshakes with the new cookie and joins the room
      onSessionReady();
      // Then start WhatsApp
      await apiFetch('/session/start', { method: 'POST' });
    } finally {
      setLoading(false);
    }
  }

  async function handleStart() {
    setLoading(true);
    try {
      const res = await apiFetch('/session/start', { method: 'POST' });
      if (res.status === 404) return handleCreate();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="session-view">

      {/* Waiting for server to emit initial status */}
      {status === 'idle' && (
        <>
          <div className="session-spinner" />
          <h2>Connecting…</h2>
          <p>Checking for an existing session.</p>
        </>
      )}

      {/* No session found */}
      {status === 'not_found' && (
        <>
          <div className="session-icon">💬</div>
          <h2>Welcome to DealFlow</h2>
          <p>Connect your WhatsApp to get started.</p>
          <button className="session-btn" onClick={handleCreate} disabled={loading}>
            {loading ? 'Starting…' : 'Create Session'}
          </button>
        </>
      )}

      {status === 'initializing' && (
        <>
          <div className="session-spinner" />
          <h2>Starting…</h2>
          <p>Launching WhatsApp Web, please wait.</p>
        </>
      )}

      {status === 'qr' && (
        <>
          <h2>Scan QR Code</h2>
          <p className="session-sub">WhatsApp → Linked Devices → Link a Device</p>
          {qrDataUrl
            ? <div className="qr-wrap"><img src={qrDataUrl} alt="WhatsApp QR" className="qr-img" /></div>
            : <div className="session-spinner" />
          }
          <p className="session-hint">QR refreshes automatically if it expires.</p>
        </>
      )}

      {status === 'authenticated' && (
        <>
          <div className="session-spinner" />
          <h2>Connecting…</h2>
          <p>Finishing handshake, almost done.</p>
        </>
      )}

      {status === 'disconnected' && (
        <>
          <div className="session-icon">📵</div>
          <h2>Disconnected</h2>
          <p>Your session was lost.</p>
          <button className="session-btn" onClick={handleStart} disabled={loading}>
            {loading ? 'Starting…' : 'Reconnect'}
          </button>
        </>
      )}

    </div>
  );
}
