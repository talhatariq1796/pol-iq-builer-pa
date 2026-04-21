import { useMemo } from 'react';
import { getStateManager } from '@/lib/ai-native/ApplicationStateManager';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  count?: number;
}

export function useBreadcrumbs(currentPage: string): BreadcrumbItem[] {
  return useMemo(() => {
    try {
      const stateManager = getStateManager();
      const state = stateManager.getState();
      const history = state.explorationHistory || [];

      // Base breadcrumb
      const crumbs: BreadcrumbItem[] = [
        { label: 'Home', href: '/political-ai' }
      ];

      // Add current page
      const pageLabels: Record<string, string> = {
        'segments': 'Segments',
        'donors': 'Donors',
        'canvass': 'Canvassing',
        'compare': 'Compare',
        'knowledge-graph': 'Knowledge Graph',
        'settings': 'Settings',
      };

      if (pageLabels[currentPage]) {
        crumbs.push({ label: pageLabels[currentPage], href: `/${currentPage}` });
      }

      // Add context from recent exploration
      const recentFilters = history
        .filter(e => e.tool === currentPage && e.action === 'filter')
        .slice(-1);

      if (recentFilters.length > 0) {
        const filter = recentFilters[0];
        if (filter.metadata?.filterName) {
          crumbs.push({ label: filter.metadata.filterName as string });
        }
      }

      // Add precinct count if available
      const recentPrecincts = history
        .filter(e => e.tool === currentPage && e.precinctIds?.length)
        .slice(-1);

      if (recentPrecincts.length > 0 && recentPrecincts[0].precinctIds) {
        const last = crumbs[crumbs.length - 1];
        if (last) {
          last.count = recentPrecincts[0].precinctIds.length;
        }
      }

      return crumbs;
    } catch {
      return [{ label: 'Home', href: '/political-ai' }];
    }
  }, [currentPage]);
}
