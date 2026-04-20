'use client';

import { useEffect, useRef, useState } from 'react';

interface LogEntry {
  timestamp: string;
  level: string;
  context: string;
  message: string;
}

const LEVEL_COLOR: Record<string, string> = {
  ERROR:   '#f87171',  // red
  WARN:    '#fbbf24',  // yellow
  LOG:     '#4ade80',  // green  (NestJS default)
  VERBOSE: '#60a5fa',  // blue
  DEBUG:   '#818cf8',  // purple
};

export default function LogsPage() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoScroll = useRef(true);

  useEffect(() => {
    const es = new EventSource('/api/logs');

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = e => {
      try {
        const entry: LogEntry = JSON.parse(e.data);
        setEntries(prev => [...prev.slice(-1000), entry]);
      } catch {}
    };

    return () => es.close();
  }, []);

  useEffect(() => {
    if (autoScroll.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [entries]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    autoScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px - 48px)' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Log</h1>
          <p className="text-sm text-gray-400 mt-1">Stream in tempo reale dal backend</p>
        </div>
        <span
          className="text-xs font-bold px-3 py-1"
          style={{
            backgroundColor: connected ? '#ecfdf5' : '#fef2f2',
            color: connected ? '#059669' : '#dc2626',
          }}
        >
          {connected ? '● CONNESSO' : '○ DISCONNESSO'}
        </span>
      </div>

      <div
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          backgroundColor: '#0f172a',
          fontFamily: '"Fira Mono", "Cascadia Code", "Consolas", monospace',
          fontSize: 12,
          lineHeight: '20px',
          padding: '16px',
          borderRadius: 0,
        }}
      >
        {entries.length === 0 && (
          <span style={{ color: '#475569' }}>In attesa di log...</span>
        )}
        {entries.map((entry, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 1 }}>
            <span style={{ color: '#475569', flexShrink: 0, userSelect: 'none' }}>
              {new Date(entry.timestamp).toLocaleTimeString('it-IT', {
                hour: '2-digit', minute: '2-digit', second: '2-digit',
              })}
            </span>
            <span style={{
              color: LEVEL_COLOR[entry.level] ?? '#94a3b8',
              flexShrink: 0,
              width: 60,
              fontWeight: 700,
            }}>
              {entry.level}
            </span>
            {entry.context && (
              <span style={{ color: '#f0b429', flexShrink: 0 }}>
                [{entry.context}]
              </span>
            )}
            <span style={{ color: '#e2e8f0', wordBreak: 'break-all' }}>
              {entry.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div
        style={{
          backgroundColor: '#0f172a',
          borderTop: '1px solid #1e293b',
          padding: '6px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ color: '#475569', fontSize: 11 }}>
          {entries.length} righe
        </span>
        <button
          onClick={() => setEntries([])}
          style={{
            color: '#475569',
            fontSize: 11,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 8px',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')}
          onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
        >
          Cancella
        </button>
      </div>
    </div>
  );
}
