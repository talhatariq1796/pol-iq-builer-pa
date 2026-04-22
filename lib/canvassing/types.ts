/**
 * Canvassing Types
 *
 * Core type definitions for canvassing universe management.
 */

export type DensityType = 'urban' | 'suburban' | 'rural';

export interface CanvassingPrecinct {
  precinctId: string;
  precinctName: string;
  jurisdiction: string;
  priorityRank: number;
  estimatedDoors: number;
  estimatedHours: number;
  estimatedTurfs?: number;
  gotvPriority: number;
  persuasionOpportunity: number;
  swingPotential: number;
  targetingStrategy: string;
  assignedVolunteers?: string[];
  status?: string;
  density?: DensityType;
  centroid?: [number, number];
}

export interface CanvassingUniverse {
  id: string;
  name: string;
  description: string;
  precincts: CanvassingPrecinct[];
  targetDoorsPerTurf: number;
  targetDoorsPerHour: number;
  targetContactRate: number;
  totalPrecincts: number;
  totalEstimatedDoors: number;
  estimatedTurfs: number;
  estimatedHours: number;
  volunteersNeeded: number;
  createdAt?: string;
  updatedAt?: string;
  segmentId?: string;
}

export interface CanvassSummary {
  universeName: string;
  createdAt: string;
  precincts: number;
  estimatedDoors: number;
  estimatedTurfs: number;
  estimatedHours: number;
  volunteersFor8HrShifts: number;
  volunteersFor4HrShifts: number;
  expectedContacts: number;
  contactRate: number;
  topPrecincts: Array<{ rank: number; name: string; doors: number }>;
  strategyBreakdown: Record<string, number>;
}
