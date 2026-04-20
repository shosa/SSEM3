'use client';

import { useEffect, useRef, useCallback } from 'react';

export interface AlarmSettings {
  beepFrequency: number;   // Hz
  beepDuration: number;    // ms
  beepInterval: number;    // ms between beeps
  alarmOnZeroPower: boolean;
}

export const DEFAULT_ALARM_SETTINGS: AlarmSettings = {
  beepFrequency: 800,
  beepDuration: 200,
  beepInterval: 3000,
  alarmOnZeroPower: true,
};

export function loadAlarmSettings(): AlarmSettings {
  if (typeof window === 'undefined') return DEFAULT_ALARM_SETTINGS;
  try {
    const raw = localStorage.getItem('ssem3_alarm_settings');
    return raw ? { ...DEFAULT_ALARM_SETTINGS, ...JSON.parse(raw) } : DEFAULT_ALARM_SETTINGS;
  } catch {
    return DEFAULT_ALARM_SETTINGS;
  }
}

export function saveAlarmSettings(s: AlarmSettings) {
  localStorage.setItem('ssem3_alarm_settings', JSON.stringify(s));
}

export function useAlarm() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const settingsRef = useRef<AlarmSettings>(DEFAULT_ALARM_SETTINGS);

  useEffect(() => {
    settingsRef.current = loadAlarmSettings();
    return () => stopAlarm();
  }, []);

  const initAudio = useCallback(() => {
    if (audioCtxRef.current) return;
    try {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {}
  }, []);

  const beep = useCallback((hz: number) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = hz;
      gain.gain.value = 0.3;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setTimeout(() => osc.stop(), settingsRef.current.beepDuration);
    } catch {}
  }, []);

  const startAlarm = useCallback((zeroPower = false) => {
    initAudio();
    stopAlarm();
    settingsRef.current = loadAlarmSettings();
    const hz = zeroPower
      ? settingsRef.current.beepFrequency * 1.5
      : settingsRef.current.beepFrequency;
    beep(hz);
    intervalRef.current = setInterval(() => beep(hz), settingsRef.current.beepInterval);
  }, [initAudio, beep]);

  const stopAlarm = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const isActive = useCallback(() => intervalRef.current !== null, []);

  return { startAlarm, stopAlarm, isActive, initAudio };
}
