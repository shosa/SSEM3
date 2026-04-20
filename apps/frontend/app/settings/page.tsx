'use client';

import { useEffect, useState } from 'react';
import { AppConfig, AuroraPlantConfig, fetchConfig, saveConfig } from '@/lib/api';
import { AlarmSettings, DEFAULT_ALARM_SETTINGS, loadAlarmSettings, saveAlarmSettings } from '@/lib/useAlarm';

type SaveState = 'idle' | 'saving' | 'ok' | 'error';
type Section = 'aurora' | 'fusion' | 'alarm';

const inputClass =
  'w-full bg-white border border-gray-200 px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-300 placeholder-gray-300 transition-shadow';

const labelClass = 'block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5';

function Field({ label, type = 'text', value, onChange, placeholder }: {
  label: string; type?: string; value: string | number;
  onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} className={inputClass} />
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div
        onClick={onChange}
        style={{
          width: 44, height: 24, borderRadius: 12, padding: 2,
          backgroundColor: checked ? '#10b981' : '#d1d5db',
          transition: 'background-color 0.2s',
          display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0,
        }}
      >
        <div style={{
          width: 20, height: 20, borderRadius: '50%', backgroundColor: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transform: checked ? 'translateX(20px)' : 'translateX(0)',
          transition: 'transform 0.2s',
        }} />
      </div>
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </label>
  );
}

const SECTIONS: { id: Section; label: string; sub: string }[] = [
  { id: 'aurora',  label: 'AuroraVision',       sub: 'Credenziali e impianti' },
  { id: 'fusion',  label: 'FusionSolar',         sub: 'Huawei integration'    },
  { id: 'alarm',   label: 'Allarme Sonoro',       sub: 'Beep e notifiche'      },
];

export default function SettingsPage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [alarm, setAlarm] = useState<AlarmSettings>(DEFAULT_ALARM_SETTINGS);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [loadError, setLoadError] = useState(false);
  const [active, setActive] = useState<Section>('aurora');

  useEffect(() => {
    fetchConfig().then(setConfig).catch(() => setLoadError(true));
    setAlarm(loadAlarmSettings());
  }, []);

  if (loadError) return (
    <div className="flex items-center justify-center py-24 text-red-400">
      Impossibile caricare la configurazione — backend non raggiungibile
    </div>
  );

  if (!config) return (
    <div className="flex items-center justify-center py-24 text-gray-400">
      <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mr-2" />
      Caricamento...
    </div>
  );

  const setAurora = (p: Partial<typeof config.aurora>) => setConfig({ ...config, aurora: { ...config.aurora, ...p } });
  const setFusion = (p: Partial<typeof config.fusion>) => setConfig({ ...config, fusion: { ...config.fusion, ...p } });

  const addPlant = () => setAurora({ plants: [...config.aurora.plants, { entityId: '', name: '' }] });
  const removePlant = (i: number) => setAurora({ plants: config.aurora.plants.filter((_, idx) => idx !== i) });
  const updatePlant = (i: number, p: Partial<AuroraPlantConfig>) =>
    setAurora({ plants: config.aurora.plants.map((pl, idx) => idx === i ? { ...pl, ...p } : pl) });

  const handleSave = async () => {
    setSaveState('saving');
    try {
      await saveConfig(config);
      saveAlarmSettings(alarm);
      setSaveState('ok');
      setTimeout(() => setSaveState('idle'), 2500);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Impostazioni</h1>
          <p className="text-sm text-gray-400 mt-1">Configurazione provider e preferenze</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saveState === 'saving'}
          className="px-6 py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-50"
          style={{
            backgroundColor: saveState === 'ok' ? '#10b981' : saveState === 'error' ? '#ef4444' : '#111827',
          }}
        >
          {saveState === 'saving' ? 'Salvataggio...' : saveState === 'ok' ? '✓ Salvato' : saveState === 'error' ? '✗ Errore' : 'Salva'}
        </button>
      </div>

      <div className="flex gap-6 items-start">
        {/* Sidebar */}
        <div className="w-56 flex-shrink-0 bg-white shadow-sm overflow-hidden">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className="w-full text-left px-5 py-4 border-b border-gray-50 transition-colors"
              style={{
                borderLeft: active === s.id ? '4px solid #111827' : '4px solid transparent',
                backgroundColor: active === s.id ? '#f9fafb' : '#ffffff',
              }}
            >
              <p className={`text-sm font-bold ${active === s.id ? 'text-gray-900' : 'text-gray-500'}`}>{s.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
            </button>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 bg-white shadow-sm overflow-hidden">

          {active === 'aurora' && (
            <div className="px-8 py-6 space-y-5">
              <h2 className="font-black text-gray-800 text-lg border-b border-gray-100 pb-4">AuroraVision</h2>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Username" value={config.aurora.username} onChange={v => setAurora({ username: v })} placeholder="utente@email.com" />
                <Field label="Password" type="password" value={config.aurora.password} onChange={v => setAurora({ password: v })} />
              </div>
              <Field label="Intervallo aggiornamento (secondi)" type="number" value={config.aurora.updateInterval} onChange={v => setAurora({ updateInterval: parseInt(v) || 300 })} />
              <div>
                <label className={labelClass}>Impianti</label>
                <div className="space-y-2">
                  {config.aurora.plants.map((plant, i) => (
                    <div key={i} className="flex gap-2">
                      <input type="text" value={plant.entityId} onChange={e => updatePlant(i, { entityId: e.target.value })}
                        placeholder="Entity ID" className={`${inputClass} flex-1`} />
                      <input type="text" value={plant.name} onChange={e => updatePlant(i, { name: e.target.value })}
                        placeholder="Nome impianto" className={`${inputClass} flex-1`} />
                      <button onClick={() => removePlant(i)}
                        className="px-3 py-2 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors text-sm">✕</button>
                    </div>
                  ))}
                  <button onClick={addPlant}
                    className="text-sm text-gray-400 hover:text-gray-700 py-2 px-3 border border-dashed border-gray-200 hover:border-gray-400 transition-colors w-full">
                    + Aggiungi impianto
                  </button>
                </div>
              </div>
            </div>
          )}

          {active === 'fusion' && (
            <div className="px-8 py-6 space-y-5">
              <h2 className="font-black text-gray-800 text-lg border-b border-gray-100 pb-4">FusionSolar (Huawei)</h2>
              <Toggle checked={config.fusion.enabled} onChange={() => setFusion({ enabled: !config.fusion.enabled })}
                label={config.fusion.enabled ? 'Integrazione abilitata' : 'Integrazione disabilitata'} />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Subdomain" value={config.fusion.subdomain} onChange={v => setFusion({ subdomain: v })} placeholder="uni005eu5" />
                <Field label="Nome impianto" value={config.fusion.plantName} onChange={v => setFusion({ plantName: v })} />
                <Field label="Username" value={config.fusion.username} onChange={v => setFusion({ username: v })} placeholder="utente@email.com" />
                <Field label="Password" type="password" value={config.fusion.password} onChange={v => setFusion({ password: v })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Intervallo aggiornamento (secondi)" type="number" value={config.fusion.updateInterval} onChange={v => setFusion({ updateInterval: parseInt(v) || 300 })} />
                <Field label="Percorso modello CAPTCHA" value={config.fusion.captchaModelPath} onChange={v => setFusion({ captchaModelPath: v })} placeholder="config/captcha_huawei.onnx" />
              </div>
            </div>
          )}

          {active === 'alarm' && (
            <div className="px-8 py-6 space-y-5">
              <h2 className="font-black text-gray-800 text-lg border-b border-gray-100 pb-4">Allarme Sonoro</h2>
              <Toggle checked={alarm.alarmOnZeroPower} onChange={() => setAlarm({ ...alarm, alarmOnZeroPower: !alarm.alarmOnZeroPower })}
                label="Allarme anche su potenza zero" />
              <div className="grid grid-cols-3 gap-4">
                <Field label="Frequenza beep (Hz)" type="number" value={alarm.beepFrequency} onChange={v => setAlarm({ ...alarm, beepFrequency: parseInt(v) || 800 })} placeholder="800" />
                <Field label="Durata beep (ms)" type="number" value={alarm.beepDuration} onChange={v => setAlarm({ ...alarm, beepDuration: parseInt(v) || 200 })} placeholder="200" />
                <Field label="Intervallo tra beep (ms)" type="number" value={alarm.beepInterval} onChange={v => setAlarm({ ...alarm, beepInterval: parseInt(v) || 3000 })} placeholder="3000" />
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center mt-6">
        Le modifiche agli impianti richiedono il riavvio del backend per essere applicate.
      </p>
    </div>
  );
}
