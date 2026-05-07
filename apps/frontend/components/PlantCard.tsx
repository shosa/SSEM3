'use client';

import { useEffect, useState } from 'react';
import { PlantState } from '@/lib/api';

const STATUS = {
  online:       { accent: '#10b981', label: 'ONLINE',   textColor: '#059669', bg: '#ecfdf5' },
  warning:      { accent: '#f59e0b', label: 'INATTIVO', textColor: '#d97706', bg: '#fffbeb' },
  offline:      { accent: '#ef4444', label: 'OFFLINE',  textColor: '#dc2626', bg: '#fef2f2' },
  initializing: { accent: '#94a3b8', label: 'AVVIO',    textColor: '#64748b', bg: '#f8fafc' },
};

export default function PlantCard({ plant, index = 0, updateInterval }: {
  plant: PlantState;
  index?: number;
  updateInterval?: number;
}) {
  const readingAgeMin = plant.lastValidReading
    ? Math.floor((Date.now() - new Date(plant.lastValidReading).getTime()) / 60000)
    : null;

  const STALE_THRESHOLD_MIN = 70;
  const isStale = readingAgeMin !== null && readingAgeMin >= STALE_THRESHOLD_MIN;
  const isRealtime = readingAgeMin !== null && readingAgeMin < STALE_THRESHOLD_MIN;

  const ageDisplay = readingAgeMin !== null
    ? readingAgeMin >= 60
      ? `~${Math.floor(readingAgeMin / 60)}h fa`
      : `~${readingAgeMin}m fa`
    : null;

  const baseStatus = STATUS[plant.status] ?? STATUS.offline;
  const s = isStale && plant.status === 'online'
    ? { accent: '#f59e0b', label: 'ONLINE', textColor: '#d97706', bg: '#fffbeb' }
    : baseStatus;
  const isAlarm = plant.status === 'offline';
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!isAlarm) { setFlash(false); return; }
    const t = setInterval(() => setFlash(f => !f), 600);
    return () => clearInterval(t);
  }, [isAlarm]);

  const lastUpdate = plant.lastUpdate
    ? new Date(plant.lastUpdate).toLocaleString('it-IT', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
    : null;

  const delayClass = ['card-enter-1','card-enter-2','card-enter-3','card-enter-4'][index % 4];

  const cardBg    = isAlarm ? (flash ? '#ef4444' : '#ffffff') : '#ffffff';
  const nameColor = isAlarm ? (flash ? '#ffffff' : '#1e293b') : '#1e293b';
  const subColor  = isAlarm ? (flash ? 'rgba(255,255,255,0.8)' : '#94a3b8') : '#94a3b8';

  return (
    <div
      className={`card-enter ${delayClass} overflow-hidden transition-colors duration-300`}
      style={{
        borderLeft: `6px solid ${s.accent}`,
        width: '500px',
        backgroundColor: cardBg,
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07), 0 10px 30px -5px rgba(0,0,0,0.10)',
        transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 8px 16px -2px rgba(0,0,0,0.10), 0 20px 50px -8px rgba(0,0,0,0.16)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.07), 0 10px 30px -5px rgba(0,0,0,0.10)')}
    >
      {/* Header */}
      <div className="px-6 pt-5 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span style={{ color: subColor }}>☀</span>
          <h3 className="font-black tracking-widest uppercase text-sm" style={{ color: nameColor }}>
            {plant.name}
          </h3>
        </div>
        <span
          className="text-[10px] font-bold tracking-widest uppercase px-2.5 py-1"
          style={{ background: '#eff6ff', color: '#2563eb' }}
        >
          {plant.type === 'aurora' ? 'Aurora' : 'Fusion'}
        </span>
      </div>

      {/* Status badge */}
      <div
        className="px-6 py-4 flex items-center gap-4"
        style={{ background: isAlarm ? (flash ? 'rgba(0,0,0,0.1)' : s.bg) : s.bg, transition: 'background 0.3s ease' }}
      >
        <span
          className={`w-10 h-10 rounded-full flex-shrink-0 ${plant.status === 'online' ? 'pulse-online' : ''}`}
          style={{ background: isAlarm && flash ? '#ffffff' : s.accent }}
        />
        <span
          className="text-2xl font-black tracking-widest"
          style={{ color: isAlarm && flash ? '#ffffff' : s.textColor }}
        >
          {s.label}
        </span>
        {isStale && (
          <span className="text-xs font-black tracking-widest px-2.5 py-1 rounded-full" style={{ background: '#fef3c7', color: '#b45309' }}>
            ATTENZIONE
          </span>
        )}
      </div>

      {/* Power */}
      <div className="px-6 py-5">
        <div className="flex items-baseline gap-3">
          <span
            className="text-5xl font-black tabular-nums leading-none"
            style={{ color: isStale ? '#d97706' : nameColor }}
          >
            {plant.isOnline && plant.power != null ? plant.power.toFixed(2) : '—'}
          </span>
          <span className="text-xl font-semibold" style={{ color: subColor }}>kW</span>
          {isStale && ageDisplay && (
            <span
              className="text-xs font-black px-3 py-1 rounded-full"
              style={{ background: '#fef3c7', color: '#b45309' }}
              title={`Ultima lettura reale: ${new Date(plant.lastValidReading!).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`}
            >
              {ageDisplay}
            </span>
          )}
          {isRealtime && (
            <span
              className="text-xs font-black px-3 py-1 rounded-full"
              style={{ background: '#dcfce7', color: '#15803d' }}
            >
              IN TEMPO REALE
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        className="px-6 pb-5 pt-3 flex items-start justify-between gap-4"
        style={{ borderTop: `1px solid ${isAlarm && flash ? 'rgba(255,255,255,0.2)' : '#f1f5f9'}` }}
      >
        <div>
          {lastUpdate ? (
            <p className="text-xs" style={{ color: subColor }}>Aggiornato: {lastUpdate}</p>
          ) : (
            <p className="text-xs" style={{ color: subColor }}>In attesa di dati...</p>
          )}
          {plant.errorMessage && !plant.isOnline && (
            <p className="text-xs mt-1 flex items-center gap-1" style={{ color: isAlarm && flash ? '#fecaca' : '#f87171' }}>
              <span>⚠</span> {plant.errorMessage}
            </p>
          )}
        </div>
        {updateInterval && (
          <p className="text-xs whitespace-nowrap" style={{ color: subColor }}>
            ogni {Math.round(updateInterval / 60)} min
          </p>
        )}
      </div>
    </div>
  );
}
