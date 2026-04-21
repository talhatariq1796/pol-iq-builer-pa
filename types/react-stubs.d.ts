// Temporary React type shim for focused local compilation.
// Replace this file by installing the correct @types/react package for the project's React version.

declare module 'react' {
  // Hooks
  export function useState<S>(initial: S | (() => S)): [S, (s: S | ((prev: S) => S)) => void];
  export function useRef<T>(initial?: T | null): { current: T | null };
  export function useEffect(cb: () => void | (() => void), deps?: any[]): void;
  export function useCallback<T extends (...args: any[]) => any>(cb: T, deps?: any[]): T;
  export function useMemo<T>(cb: () => T, deps?: any[]): T;

  // Elements / types
  export type ReactElement = any;
  export function memo<T extends any>(c: T): T;
  export type ReactNode = any;
  export type ComponentType<P = any> = any;
  export type FC<P = any> = (props: P) => ReactElement;

  // Event types (simplified)
  export type ChangeEvent<T = any> = any;
  export type MouseEvent<T = any> = any;
  export type FormEvent<T = any> = any;

  // Dispatch & SetStateAction
  export type SetStateAction<S> = S | ((prev: S) => S);
  export type Dispatch<A> = (a: A) => void;

  // Compatibility alias for older types expecting SFC
  export type SFC<P = {}> = FC<P>;
}
