/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * CMA Data Service - stub implementation
 */

export class CMADataService {
  private static instance: CMADataService;

  private constructor() {}

  static getInstance(): CMADataService {
    if (!CMADataService.instance) {
      CMADataService.instance = new CMADataService();
    }
    return CMADataService.instance;
  }

  async loadCMAData(): Promise<void> {
    // stub
  }

  getCMATableData(id: string): Record<string, any> | null {
    void id;
    return null;
  }
}

export default CMADataService;
