export default function LiveLog({ logs, onClear }) {
  if (logs.length === 0) return null;

  return (
    <div className="live-log">
      <div className="log-header">
        <span>Live Feed</span>
        <button onClick={onClear}>Clear</button>
      </div>
      <ul>
        {logs.map((entry, i) => (
          <li key={i} className={`log-entry ${entry.status}`}>
            <span className="log-time">{new Date(entry.timestamp).toLocaleTimeString()}</span>
            {entry.status === 'done'
              ? <span>All messages sent ✅</span>
              : entry.status === 'job_failed'
              ? <span>Job failed ❌ — {entry.error}</span>
              : (
                <>
                  <span className="log-status">
                    {entry.status === 'sent' ? '✅' : '❌'}
                  </span>
                  <span className="log-msg">{entry.label ?? entry.message}</span>
                  <span className="log-group">→ {entry.group}</span>
                </>
              )
            }
          </li>
        ))}
      </ul>
    </div>
  );
}
