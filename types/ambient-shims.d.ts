// Minimal ambient shims to reduce top-level TypeScript noise during triage.
// These are intentionally small and reversible. They provide the few types
// referenced widely in the codebase so we can run cross-file checks.

declare namespace __esri {
  interface Extent {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
    spatialReference?: any;
  }
}

// Minimal ArcGISLayer type referenced in lib/migration/types.ts
interface ArcGISLayer {
  id: number | string;
  name?: string;
  type?: string;
  geometryType?: string;
}

export {};

// Temporary augmentation: allow a `timeout` property on RequestInit
// to match some existing fetch usages in migration utilities. This is
// a conservative, reversible shim used only for triage.
declare global {
  interface RequestInit {
    timeout?: number;
  }
}
