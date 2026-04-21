declare module 'google-trends-api' {
  interface TrendsQuery {
    keyword: string;
    timeframe?: string;
    geo?: string;
    category?: number;
    searchType?: 'web' | 'images' | 'news' | 'youtube' | 'shopping';
  }

  interface TrendsPoint {
    time: string;
    value: number[];
  }

  export const googleTrends: {
    interestOverTime(query: TrendsQuery): Promise<TrendsPoint[]>;
  };
} 