import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const API = import.meta.env.VITE_API_URL || '';

export function useSocket() {
  const [logs, setLogs] = useState([]);
  const [waStatus, setWaStatus] = useState({ status: 'idle', qrDataUrl: null });
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(API, { withCredentials: true });
    socketRef.current = socket;

    socket.on('wa_status', (state) => {
      setWaStatus(state);
    });

    socket.on('log', (entry) => {
      setLogs(prev => [entry, ...prev].slice(0, 200));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Call after creating/restoring a session so the socket re-handshakes
  // with the new cookie and joins the correct room.
  function reconnectSocket() {
    const socket = socketRef.current;
    if (!socket) return;
    socket.disconnect();
    socket.connect();
  }

  return {
    logs,
    waStatus,
    clearLogs: () => setLogs([]),
    reconnectSocket,
  };
}
