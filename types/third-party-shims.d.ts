// Minimal temporary type shims to reduce TypeScript noise during triage.
// These are intentionally small and conservative. Replace with proper
// @types packages or real module augmentations before merging.

declare module 'recharts' {
  // Provide minimal component types so JSX usage compiles in this repo
  import * as React from 'react';
  export const LineChart: React.ComponentType<any>;
  export const Line: React.ComponentType<any>;
  export const XAxis: React.ComponentType<any>;
  export const YAxis: React.ComponentType<any>;
  export const CartesianGrid: React.ComponentType<any>;
  export const Tooltip: React.ComponentType<any>;
  export const Legend: React.ComponentType<any>;
  export const PieChart: React.ComponentType<any>;
  export const Pie: React.ComponentType<any>;
  export const Cell: React.ComponentType<any>;
  export const BarChart: React.ComponentType<any>;
  export const Bar: React.ComponentType<any>;
  export const ResponsiveContainer: React.ComponentType<any>;
  export const Area: React.ComponentType<any>;
  export const PolarChart: React.ComponentType<any>;
}

declare module '@radix-ui/react-tooltip' {
  import * as React from 'react';
  export const Provider: React.ComponentType<any>;
  export const Root: React.ComponentType<any>;
  export const Trigger: React.ComponentType<any>;
  export const Content: React.ComponentType<any> & { displayName?: string };
}

// Minimal React surface used when @types/react is missing or mismatched.
declare module 'react' {
  export type ReactNode = any;
  export type ReactElement = any;
  export type ElementRef<T> = any;
  export type ComponentPropsWithoutRef<T> = any;
  export type Ref<T> = any;
  export type HTMLAttributes<T> = { [k: string]: any };
  export type ButtonHTMLAttributes<T> = { [k: string]: any };
  export type InputHTMLAttributes<T> = { [k: string]: any };
  export type TextareaHTMLAttributes<T> = { [k: string]: any };
  export type ThHTMLAttributes<T> = { [k: string]: any };
  export type TdHTMLAttributes<T> = { [k: string]: any };
  export function forwardRef(render: (props: any, ref: any) => any): any;
  export const Children: {
    map(children: any, fn: (child: any) => any): any;
  };
  export function isValidElement(val: any): boolean;
  export function cloneElement(element: any, props?: any): any;
  export const createElement: any;
  export const Fragment: any;
  export function useState<T = any>(initial?: T): [T, (v: any) => void];
  export function useRef<T = any>(initial?: T): { current: T };
  export default any;
}

// Allow <style jsx> attributes commonly used in Next.js
declare global {
  namespace JSX {
    interface IntrinsicElements {
      style: any; // allow style jsx
    }
  }
}
