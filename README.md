# DealFlow — WhatsApp Broadcast Tool

A full-stack tool for broadcasting messages to multiple WhatsApp groups at once. Scan a QR code to connect your WhatsApp account, pick your target groups, compose text and media messages, and send them all in one click — with built-in rate limiting and anti-ban protection.

---

## Features

- **Multi-session support** — multiple users can each connect their own WhatsApp account simultaneously via cookie-based sessions
- **QR authentication** — connect any WhatsApp number by scanning a QR code in the browser
- **Session persistence** — authenticated sessions survive server restarts (no re-scanning needed for up to 7 days)
- **Group broadcasting** — fetch all your WhatsApp groups and broadcast to any selection
- **Text + media messages** — send plain text, images, or video with captions
- **Multi-message sequences** — compose an ordered sequence of messages sent to every group
- **Paste-to-compose** — paste text or images directly into the broadcast zone
- **Anti-ban protection** — random delays between sends, sliding-window rate limiter, and exponential-backoff retries
- **Real-time live log** — Socket.IO powered feed shows every send result as it happens
- **3-step guided UI** — Connect → Select Groups → Compose & Send

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Socket.IO client |
| Backend | Node.js, Express 5, Socket.IO |
| WhatsApp | whatsapp-web.js (Puppeteer) |
| Queue | In-memory job queue with rate limiter |
| Auth | Cookie-based sessions + LocalAuth (on-disk) |

---

## Project Structure

```
dealflow/
├── backend/
│   ├── index.js                  # Express server + session routes
│   └── src/
│       ├── bot/
│       │   └── sessionManager.js # Multi-session lifecycle (create, start, restore)
│       ├── controllers/
│       │   └── broadcastController.js
│       ├── queue/
│       │   └── broadcastQueue.js # In-memory job queue + parallel group sends
│       ├── routes/
│       │   ├── broadcast.js
│       │   └── groups.js
│       ├── services/
│       │   └── groupStore.js
│       └── utils/
│           ├── antiBan.js        # randomDelay, sendWithRetry, RateLimiter
│           └── io.js             # Socket.IO singleton
└── frontend/
    └── src/
        ├── App.jsx               # 3-step flow orchestration
        ├── components/
        │   ├── SessionView.jsx   # QR display + connect flow
        │   ├── GroupSelector.jsx # Group list + multi-select
        │   ├── MessageCard.jsx   # Text/media message composer
        │   ├── PasteZone.jsx     # Paste-to-compose drop zone
        │   └── LiveLog.jsx       # Real-time send log
        ├── hooks/
        │   └── useSocket.js      # Socket.IO + WA status state
        └── api.js
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A WhatsApp account (mobile)

### 1. Clone the repo

```bash
git clone https://github.com/Techtide0/Push-bot.git
cd Push-bot/dealflow
```

### 2. Set up the backend

```bash
cd backend
npm install
```

Create a `.env` file:

```env
PORT=3001

# Anti-ban tuning (optional — these are the defaults)
MIN_DELAY_MS=2000
MAX_DELAY_MS=5000
MAX_RETRIES=3
MAX_PER_MINUTE=20
```

Start the server:

```bash
node index.js
```

### 3. Set up the frontend

```bash
cd ../frontend
npm install
```

Create a `.env` file:

```env
VITE_API_URL=http://localhost:3001
```

Start the dev server:

```bash
npm run dev
```

### 4. Connect WhatsApp

1. Open `http://localhost:5173` in your browser
2. Click **Connect** — a QR code will appear
3. Open WhatsApp on your phone → **Linked Devices** → **Link a Device**
4. Scan the QR code
5. Once connected, the UI advances to group selection automatically

---

## How It Works

### Session lifecycle

Each browser gets a unique session ID stored in an `httpOnly` cookie (`df_session`). The backend maps that ID to a dedicated `whatsapp-web.js` Client instance. Sessions are persisted to disk and automatically restored on server restart — no re-scanning needed as long as the session is less than 7 days old.

### Broadcast queue

When you hit Send, the backend enqueues a job containing your messages and selected groups. Groups are processed in parallel; messages within each group are sent sequentially. Every send passes through:

1. **Rate limiter** — sliding 1-minute window, default cap of 20 sends/min
2. **Random delay** — 2–5 second human-like pause between messages
3. **Retry logic** — up to 3 attempts with exponential backoff on failure

### Real-time updates

Socket.IO pushes `wa_status` events (QR ready, authenticated, connected, disconnected) and `log` events (sent/failed per message) directly to the browser session that owns the connection.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/session/create` | Create or reuse a session cookie |
| `POST` | `/session/start` | Initialize the WhatsApp client (triggers QR) |
| `GET` | `/session/status` | Get current session state |
| `GET` | `/groups` | List all WhatsApp groups for this session |
| `POST` | `/broadcast` | Queue a broadcast job |

### `POST /broadcast`

```json
{
  "groups": ["120363XXXXXXXXXX@g.us"],
  "messages": [
    { "text": "Hello everyone!" },
    { "text": "Check this out", "media": { "data": "<base64>", "mimetype": "image/jpeg", "filename": "promo.jpg" } }
  ]
}
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Backend server port |
| `MIN_DELAY_MS` | `2000` | Minimum delay between sends (ms) |
| `MAX_DELAY_MS` | `5000` | Maximum delay between sends (ms) |
| `MAX_RETRIES` | `3` | Send retry attempts before giving up |
| `MAX_PER_MINUTE` | `20` | Rate limit cap (sends per minute) |

---

## Important Notes

- **Do not commit** `node_modules/`, `.env`, or `.wwebjs_auth/` — the `.gitignore` covers these
- WhatsApp session data is stored in `backend/.wwebjs_auth/` — back this up if you want to avoid re-scanning
- This tool uses [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) which is an unofficial WhatsApp client — use responsibly and within WhatsApp's terms of service
- Tune `MAX_PER_MINUTE`, `MIN_DELAY_MS`, and `MAX_DELAY_MS` to reduce the risk of rate limiting on large broadcasts

---

## License

MIT
