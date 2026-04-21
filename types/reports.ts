export interface ReportTemplate {
    id: string;
    name: string;
    category: string;
  }
  
  export interface GroupedTemplates {
    [category: string]: ReportTemplate[];
  }

  export interface PDFData {
    demographic: string;
    market: string;
    psychographic?: string;
    charts: ChartData[];
  }
  
  export interface ChartData {
    id: string;
    type: 'bar' | 'line' | 'pie' | 'donut';
    title: string;
    data: DataPoint[];
    config: ChartConfig;
  }
  
  export interface DataPoint {
    name: string;
    value: number;
    [key: string]: any;
  }
  
  export interface ChartConfig {
    colors: string[];
    title: string;
    showLegend: boolean;
    type: 'bar' | 'line' | 'pie' | 'donut';
  }
  
  export interface AnalysisResult {
    analysis: string;
    charts: ChartData[];
  }