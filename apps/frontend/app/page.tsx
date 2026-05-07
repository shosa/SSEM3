'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { PlantState, SystemStatus, AppConfig, fetchPlants, fetchStatus, forceUpdate, fetchConfig } from '@/lib/api';
import { useAlarm, loadAlarmSettings } from '@/lib/useAlarm';
import PlantCard from '@/components/PlantCard';

const REFRESH_INTERVAL = 30_000;

export default function Dashboard() {
  const [plants, setPlants] = useState<PlantState[]>([]);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alarmActive, setAlarmActive] = useState(false);
  const [silenced, setSilenced] = useState(false);

  const { startAlarm, stopAlarm, initAudio } = useAlarm();
  const prevAlarmState = useRef<'none' | 'offline' | 'zero'>('none');

  const evaluateAlarm = useCallback((plants: PlantState[]) => {
    if (silenced) return;

    const alarmSettings = loadAlarmSettings();
    const hasOffline = plants.some(p => p.status === 'offline');
    const hasZero = alarmSettings.alarmOnZeroPower && plants.some(p => p.status === 'warning');

    const newState = hasOffline ? 'offline' : hasZero ? 'zero' : 'none';

    if (newState !== prevAlarmState.current) {
      prevAlarmState.current = newState;
      if (newState === 'none') {
        stopAlarm();
        setAlarmActive(false);
      } else {
        startAlarm(newState === 'zero');
        setAlarmActive(true);
      }
    }
  }, [silenced, startAlarm, stopAlarm]);

  const load = useCallback(async () => {
    try {
      const [p, s, c] = await Promise.all([fetchPlants(), fetchStatus(), fetchConfig()]);
      setPlants(p);
      setStatus(s);
      setConfig(c);
      setLastRefresh(new Date());
      setError(null);
      evaluateAlarm(p);
    } catch {
      setError('Backend non raggiungibile');
    }
  }, [evaluateAlarm]);

  useEffect(() => {
    load();
    const interval = setInterval(load, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [load]);

  const handleSilence = () => {
    stopAlarm();
    setAlarmActive(false);
    setSilenced(true);
    prevAlarmState.current = 'none';
  };

  const handleForceUpdate = async () => {
    initAudio(); // sblocca AudioContext dopo interazione utente
    setUpdating(true);
    setSilenced(false);
    try {
      const p = await forceUpdate();
      setPlants(p);
      setLastRefresh(new Date());
      evaluateAlarm(p);
    } catch {
      setError('Errore aggiornamento');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-8 stat-enter">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">
            {lastRefresh
              ? `Aggiornato alle ${lastRefresh.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
              : 'Caricamento...'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {alarmActive && (
            <button
              onClick={handleSilence}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-xl transition-all active:scale-95 animate-pulse"
            >
              🔔 Silenzia allarme
            </button>
          )}
          <button
            onClick={handleForceUpdate}
            disabled={updating}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-all active:scale-95"
          >
            <span className={`text-base ${updating ? 'animate-spin' : ''}`}>↻</span>
            {updating ? 'Aggiornamento...' : 'Aggiorna ora'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-red-500 text-sm font-medium">
          ⚠ {error}
        </div>
      )}

      {/* Stat cards */}
      {status && (() => {
        const STALE_MIN = 70;
        const isPlantStale = (p: PlantState) =>
          !!p.lastValidReading &&
          Math.floor((Date.now() - new Date(p.lastValidReading).getTime()) / 60000) >= STALE_MIN;

        const attenzionePlants = plants.filter(p => p.status === 'warning' || isPlantStale(p)).length;
        const onlinePlants     = plants.filter(p => p.status === 'online' && !isPlantStale(p)).length;
        const offlinePlants    = plants.filter(p => p.status === 'offline').length;

        return (
        <div className="grid grid-cols-3 gap-5 mb-10">
          {[
            { value: onlinePlants,      label: 'Impianti Online',        accent: '#10b981', text: '#059669' },
            { value: attenzionePlants,  label: 'Impianti in Attenzione', accent: '#f59e0b', text: '#d97706' },
            { value: offlinePlants,     label: 'Impianti Offline',       accent: '#ef4444', text: '#dc2626' },
          ].map(({ value, label, accent, text }, i) => (
            <div
              key={label}
              className="stat-enter bg-white shadow-sm overflow-hidden"
              style={{ borderLeft: `5px solid ${accent}`, animationDelay: `${i * 0.08}s` }}
            >
              <div className="px-7 py-6">
                <p className="text-7xl font-black tabular-nums leading-none" style={{ color: text }}>{value}</p>
                <p className="text-sm font-semibold text-gray-400 mt-3 uppercase tracking-wider">{label}</p>
              </div>
            </div>
          ))}
        </div>
        );
      })()}

      {/* Plant grid */}
      {plants.length === 0 ? (
        <div className="flex items-center justify-center py-32 text-gray-400">
          {error ? '⚠ Backend non raggiungibile' : (
            <span className="flex items-center gap-3">
              <span className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              Caricamento impianti...
            </span>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-5">
          {plants.map((plant, i) => (
            <PlantCard
              key={plant.id}
              plant={plant}
              index={i}
              updateInterval={
                plant.type === 'aurora'
                  ? config?.aurora.updateInterval
                  : config?.fusion.updateInterval
              }
            />
          ))}
        </div>
      )}

      {/* Legend */}
      {plants.length > 0 && (
        <div className="mt-10 bg-white shadow-sm p-6 stat-enter" style={{ animationDelay: '0.3s' }}>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-5">Come leggere il pannello</p>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">

            {/* Col 1 — Stato impianto */}
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Stato impianto</p>
              <div className="space-y-2.5">
                {[
                  { color: '#10b981', label: 'ONLINE',   desc: "L'impianto sta producendo energia regolarmente." },
                  { color: '#f59e0b', label: 'INATTIVO', desc: "L'impianto è raggiungibile ma non sta producendo (es. di notte o con cielo coperto)." },
                  { color: '#ef4444', label: 'OFFLINE',  desc: "L'impianto non risponde. Potrebbe esserci un problema di connessione o all'impianto stesso." },
                  { color: '#94a3b8', label: 'AVVIO',    desc: 'Il sistema si sta connettendo per la prima volta. Attendere qualche secondo.' },
                ].map(({ color, label, desc }) => (
                  <div key={label} className="flex items-start gap-2.5">
                    <span className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5" style={{ background: color }} />
                    <div>
                      <span className="text-xs font-black text-gray-700">{label} </span>
                      <span className="text-xs text-gray-400">{desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Col 2 — Indicatori sulla card */}
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Indicatori sulla scheda</p>
              <div className="space-y-4">
                <div className="flex items-start gap-2.5">
                  <span className="text-xs font-black px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: '#dcfce7', color: '#15803d' }}>IN TEMPO REALE</span>
                  <p className="text-xs text-gray-400">Il valore mostrato è aggiornato e corrisponde alla situazione attuale dell'impianto.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="text-xs font-black px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: '#fef3c7', color: '#b45309' }}>ATTENZIONE</span>
                  <p className="text-xs text-gray-400">Il valore mostrato (barrato) è l'ultimo disponibile ma non è recente. Il sistema non ha ancora ricevuto un aggiornamento nuovo dall'impianto.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="text-xs font-black px-2.5 py-1 rounded-full flex-shrink-0 whitespace-nowrap" style={{ background: '#fef3c7', color: '#b45309' }}>~2h fa</span>
                  <p className="text-xs text-gray-400">Indica da quanto tempo risale l'ultimo valore ricevuto. Più il numero è alto, meno il dato è affidabile.</p>
                </div>
              </div>
            </div>

            {/* Col 3 — Note sui sistemi */}
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Note sui sistemi</p>
              <div className="space-y-4 text-xs text-gray-400">
                <div>
                  <p className="font-black text-gray-600 mb-1">Impianti Aurora</p>
                  <p>I valori di potenza vengono aggiornati una volta ogni ora. È normale che il dato mostrato abbia fino a un'ora di ritardo rispetto alla produzione reale.</p>
                </div>
                <div>
                  <p className="font-black text-gray-600 mb-1">Impianti Fusion (Huawei)</p>
                  <p>Il portale Huawei invia nuovi dati ogni 25 minuti circa, indipendentemente da quanto spesso il sistema controlla. Si consiglia di impostare la frequenza di controllo a 25 minuti o più per evitare verifiche inutili.</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
