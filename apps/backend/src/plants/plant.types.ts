export type PlantType = 'aurora' | 'fusion';
export type PlantStatus = 'online' | 'warning' | 'offline' | 'initializing';

export interface PlantState {
  id: string;
  name: string;
  type: PlantType;
  power: number;
  energyToday: number;
  status: PlantStatus;
  isOnline: boolean;
  lastUpdate: string | null;
  errorMessage: string | null;
  consecutiveFailures: number;
}
