// types/fitness.ts

export interface FitnessMetrics {
  weeklyActiveUsers: number;
  averageClassSize: number;
  equipmentUtilization: number;
  peakHourUtilization: number;
  activityTrendChange: number;
  classAttendanceChange: number;
}

export interface TrendResult {
  date: string;
  totalVisits: number;
  uniqueMembers: number;
  averageStayDuration: number;
  peakHours: string[];
}

export interface ActivityPattern {
  type: string;
  patterns: Record<string, number>;
  confidence: number;
}

// Extend MarketOpportunity for fitness-specific opportunities
export interface FitnessOpportunity {
  id: string;
  score: number;
  region: string;
  factors: Record<string, number>;
  recommendations: string[];
}

export interface ColdData {
  marketOverview: {
    totalPotential: number;
    growthRate: number;
    storeIndex: number;
    housingUnits: number;
  };
  spendingTrends: Array<{
    category: string;
    current: number;
    projected: number;
    growthRate: number;
  }>;
  psychographics: {
    exerciseDaily: number;
    moreFitActive: number;
  };
  businesses: {
    spas: number;
    gyms: number;
  };
}

export interface ColdLayers {
  businesses: {
    spas: __esri.FeatureLayer | null;
    gyms: __esri.FeatureLayer | null;
  };
  spending: {
    sportsEquipment: __esri.FeatureLayer | null;
    workoutWear: __esri.FeatureLayer | null;
    fitnessApparel: __esri.FeatureLayer | null;
  };
  psychographics: {
    exerciseDaily: __esri.FeatureLayer | null;
    moreFitActive: __esri.FeatureLayer | null;
  };
}