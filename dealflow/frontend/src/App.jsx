import { useState } from 'react';
import SessionView from './components/SessionView';
import GroupSelector from './components/GroupSelector';
import MessageCard from './components/MessageCard';
import PasteZone from './components/PasteZone';
import LiveLog from './components/LiveLog';
import { useSocket } from './hooks/useSocket';
import { apiFetch } from './api';
import './App.css';

function newMessage() {
  return { id: crypto.randomUUID(), text: '', media: null, mediaPreview: null, mediaLoading: false, mediaError: null };
}

function Steps({ current }) {
  const steps = ['Connect', 'Groups', 'Broadcast'];
  return (
    <div className="steps">
      {steps.map((label, i) => (
        <div key={label} className={`step ${i === current ? 'active' : i < current ? 'done' : ''}`}>
          <span className="step-dot">{i < current ? '✓' : i + 1}</span>
          <span className="step-label">{label}</span>
          {i < steps.length - 1 && <span className="step-line" />}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const { logs, clearLogs, waStatus, reconnectSocket } = useSocket();

  // Groups selection lives here — GroupSelector mutates it freely
  const [selectedGroups, setSelectedGroups] = useState([]);
  // Only advance to broadcast view when user explicitly confirms
  const [groupsConfirmed, setGroupsConfirmed] = useState(false);

  const [messages, setMessages] = useState([newMessage()]);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [showSentToast, setShowSentToast] = useState(false);

  const isReady = waStatus.status === 'ready';
  const step = !isReady ? 0 : !groupsConfirmed ? 1 : 2;

  function updateMessage(id, updated) { setMessages(prev => prev.map(m => m.id === id ? updated : m)); }
  function addMessage() { setMessages(prev => [...prev, newMessage()]); }
  function removeMessage(id) { setMessages(prev => prev.filter(m => m.id !== id)); }

  function handlePaste({ text, media }) {
    // If there is exactly one empty card, fill it instead of adding another
    const emptyCard = messages.find(m => !m.text && !m.media);
    const card = {
      ...newMessage(),
      text: text || '',
      media: media ? { data: media.data, mimetype: media.mimetype, filename: media.filename } : null,
      mediaPreview: media?.previewUrl ?? null,
    };

    if (emptyCard && messages.length === 1) {
      setMessages([card]);
    } else {
      setMessages(prev => [...prev, card]);
    }
  }

  function handleChangeGroups() {
    setGroupsConfirmed(false);
    setFeedback(null);
  }

  async function handleSend() {
    const valid = messages.filter(m => m.text?.trim() || m.media?.data);
    if (!valid.length) return setFeedback({ type: 'error', msg: 'Add at least one message or image.' });
    if (messages.some(m => m.mediaLoading)) return setFeedback({ type: 'error', msg: 'Wait for media to finish loading.' });

    setSending(true);
    setFeedback(null);
    clearLogs();

    try {
      const res = await apiFetch('/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          messages: valid.map(m => ({ text: m.text || '', media: m.media || null })),
          groups: selectedGroups,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unknown error');
      setShowSentToast(true);
      setTimeout(() => {
        setShowSentToast(false);
        setMessages([newMessage()]);
        setFeedback(null);
        clearLogs();
      }, 3000);
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message });
    } finally {
      setSending(false);
    }
  }

  const readyCount = messages.filter(m => m.text?.trim() || m.media?.data).length;

  return (
    <div className="app">
      <header className="app-header">
        <h1>DealFlow</h1>
        <p className={`conn-badge ${waStatus.status}`}>
          {{ ready: '● Connected', qr: '● Scan QR', initializing: '● Starting…', authenticated: '● Connecting…', disconnected: '● Disconnected', idle: '' }[waStatus.status]}
        </p>
      </header>

      <Steps current={step} />

      <main className="app-main">

        {/* ── Step 0: connect ── */}
        {!isReady && (
          <SessionView waStatus={waStatus} onSessionReady={reconnectSocket} />
        )}

        {/* ── Step 1: pick groups ── */}
        {isReady && !groupsConfirmed && (
          <>
            <p className="step-instruction">Select the groups you want to broadcast to.</p>
            <section className="card">
              <div className="section-label">Your Groups</div>
              <GroupSelector
                selected={selectedGroups}
                onChange={setSelectedGroups}
              />
            </section>

            <button
              className="send-btn"
              disabled={selectedGroups.length === 0}
              onClick={() => setGroupsConfirmed(true)}
            >
              {selectedGroups.length === 0
                ? 'Select at least one group'
                : `Continue with ${selectedGroups.length} group${selectedGroups.length !== 1 ? 's' : ''}`
              }
            </button>
          </>
        )}

        {/* ── Step 2: compose & send ── */}
        {isReady && groupsConfirmed && (
          <>
            <div className="groups-summary">
              <span>{selectedGroups.length} group{selectedGroups.length !== 1 ? 's' : ''} selected</span>
              <button className="link-btn" onClick={handleChangeGroups}>Change</button>
            </div>

            <section>
              <div className="section-label" style={{ marginBottom: 10 }}>
                Messages
                {readyCount > 0 && <span className="selected-badge">{readyCount} ready</span>}
              </div>

              <PasteZone onPaste={handlePaste} />

              <div className="card-list">
                {messages.map((msg, i) => (
                  <MessageCard
                    key={msg.id}
                    index={i}
                    message={msg}
                    total={messages.length}
                    onChange={updated => updateMessage(msg.id, updated)}
                    onRemove={() => removeMessage(msg.id)}
                  />
                ))}
              </div>
              <button className="add-card-btn" onClick={addMessage}>+ Add Another Message</button>
            </section>

            {feedback && <div className={`feedback ${feedback.type}`}>{feedback.msg}</div>}

            <button
              className="send-btn"
              onClick={handleSend}
              disabled={sending || messages.some(m => m.mediaLoading)}
            >
              {sending
                ? 'Sending…'
                : `Send ${readyCount} message${readyCount !== 1 ? 's' : ''} to ${selectedGroups.length} group${selectedGroups.length !== 1 ? 's' : ''}`
              }
            </button>

            <LiveLog logs={logs} onClear={clearLogs} />
          </>
        )}

      </main>

      {showSentToast && (
        <div className="sent-toast">
          <div className="sent-toast-icon">✅</div>
          <div className="sent-toast-title">All messages sent!</div>
          <div className="sent-toast-sub">Clearing in a moment…</div>
          <div className="sent-toast-bar"><div className="sent-toast-bar-fill" /></div>
        </div>
      )}
    </div>
  );
}
