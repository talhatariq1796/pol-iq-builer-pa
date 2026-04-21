// Temporary patches to satisfy TypeScript during focused processor compilation.
// These are minimal and reversible; proper fixes should update or pin the
// affected third-party packages or adjust tsconfig paths.

declare module '@luma.gl/gltools' {
  // Minimal stub for CreateGLContextOptions referenced by @luma.gl/engine d.ts
  export type CreateGLContextOptions = any;
  export function createGLContext(opts?: any): any;
}

// Some older type packages reference React.SFC which has been removed in newer
// @types/react versions. Provide a small compatibility alias.
declare module 'react' {
  // @ts-ignore - augmenting for compatibility
  export type SFC<P = {}> = (props: P & { children?: any }) => any;
}
