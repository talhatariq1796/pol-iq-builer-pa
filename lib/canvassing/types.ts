import type { PrecinctMatch } from '@/lib/segmentation/types';

export type DensityType = 'urban' | 'suburban' | 'rural';

export interface CanvassingPrecinct extends Partial<PrecinctMatch> {
  id: any;
  name: any;
  precinctId: any;
  precinctName: any;
  jurisdiction: any;
  doorCount: any;
  estimatedDoors: any;
  estimatedHours: any;
  estimatedTurfs: any;
  density: any;
  assignedTurf: any;
  assignedVolunteers: any;
  priority: any;
  priorityRank: any;
  gotvPriority: any;
  persuasionOpportunity: any;
  swingPotential: any;
  partisanLean: any;
  targetingStrategy: any;
  status: any;
  notes: any;
  [key: string]: any;
}

export interface CanvassingUniverse {
  id: string;
  name: string;
  description?: string;
  precincts: CanvassingPrecinct[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface CanvassSummary {
  universeId: any;
  universeName: any;
  createdAt: any;
  totalPrecincts: any;
  totalDoors: any;
  estimatedDoors: any;
  estimatedTurfs: any;
  estimatedHours: any;
  volunteersFor8HrShifts: any;
  volunteersFor4HrShifts: any;
  expectedContacts: any;
  contactRate: any;
  avgDoorsPerHour: any;
  precincts: any;
  topPrecincts: any[];
  strategyBreakdown: Record<string, any>;
  [key: string]: any;
}
