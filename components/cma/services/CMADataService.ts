import type { CMAProperty } from '../types';

export class CMADataService {
  private static instance: CMADataService | null = null;

  static getInstance(): CMADataService {
    this.instance ??= new CMADataService();
    return this.instance;
  }

  async loadCMAData(): Promise<void> {
    return Promise.resolve();
  }

  getCMATableData(_id: string | number): Record<string, any> | null {
    return null;
  }

  static getPropertyAddress(property: Partial<CMAProperty>): string {
    return typeof property.address === 'string' && property.address.trim()
      ? property.address
      : 'Unknown Address';
  }

  static getDisplayPrice(property: Partial<CMAProperty>): number {
    return typeof property.price === 'number' ? property.price : 0;
  }
}
