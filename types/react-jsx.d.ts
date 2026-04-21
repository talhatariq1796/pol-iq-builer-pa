// Minimal JSX ambient types to allow TS to process React JSX in large UI files
// Temporary: replace with proper @types/react for project React version.

declare namespace JSX {
  // The return type of JSX expressions (components/elements)
  type Element = any;

  interface IntrinsicAttributes {
    [key: string]: any;
  }

  interface IntrinsicElements {
    // allow any intrinsic element
    [elemName: string]: any;
  }

  interface ElementClass {
    // allow any props
    render?: any;
  }
}

declare module 'react' {
  export function createElement(...args: any[]): any;
  export const Fragment: any;
}
