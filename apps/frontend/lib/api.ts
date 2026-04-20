export interface PlantState {
  id: string;
  name: string;
  type: 'aurora' | 'fusion';
  power: number;
  energyToday: number;
  status: 'online' | 'warning' | 'offline' | 'initializing';
  isOnline: boolean;
  lastUpdate: string | null;
  errorMessage: string | null;
  consecutiveFailures: number;
}

export interface SystemStatus {
  totalPlants: number;
  onlinePlants: number;
  warningPlants: number;
  offlinePlants: number;
  totalPower: number;
  updateInterval: number;
}

export interface AuroraPlantConfig {
  entityId: string;
  name: string;
}

export interface AppConfig {
  aurora: {
    username: string;
    password: string;
    plants: AuroraPlantConfig[];
    updateInterval: number;
  };
  fusion: {
    enabled: boolean;
    subdomain: string;
    username: string;
    password: string;
    captchaModelPath: string;
    plantName: string;
    plantId: string;
    updateInterval: number;
  };
}

const BASE = '/api';

export async function fetchPlants(): Promise<PlantState[]> {
  const res = await fetch(`${BASE}/plants`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Errore fetch impianti');
  return res.json();
}

export async function fetchStatus(): Promise<SystemStatus> {
  const res = await fetch(`${BASE}/status`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Errore fetch stato');
  return res.json();
}

export async function forceUpdate(): Promise<PlantState[]> {
  const res = await fetch(`${BASE}/update`, { method: 'POST' });
  if (!res.ok) throw new Error('Errore aggiornamento');
  const data = await res.json();
  return data.plants;
}

export async function fetchConfig(): Promise<AppConfig> {
  const res = await fetch(`${BASE}/config`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Errore fetch config');
  return res.json();
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const res = await fetch(`${BASE}/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('Errore salvataggio config');
}
