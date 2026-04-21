// Temporary compatibility shim for missing/react-mismatched @types in triage
// Purpose: provide minimal declarations for named React exports used across the codebase.
// This is intentionally permissive and reversible. Remove when proper @types/react is installed or upgraded.

declare module 'react' {
  // Basic node type for JSX children
  export type ReactNode = any;
  export type ErrorInfo = any;

  // Component types
  export interface FC<P = {}> {
    (props: P): ReactNode;
    displayName?: string;
    defaultProps?: Partial<P>;
  }

  export type FunctionComponent<P = {}> = FC<P>;

  export interface ComponentClass<P = {}> {
    new (props: P): Component<P, any>;
    defaultProps?: Partial<P>;
    displayName?: string;
  }

  export class Component<P = {}, S = {}> {
    props: Readonly<P>;
    state: Readonly<S>;
    context: any;
    refs: any;
    constructor(props: P);
    setState(state: any, callback?: () => void): void;
    forceUpdate(callback?: () => void): void;
    render(): ReactNode;
    componentDidMount?(): void;
    componentWillUnmount?(): void;
    componentDidCatch?(error: Error, errorInfo: ErrorInfo): void;
    static getDerivedStateFromError?(error: Error): any;
  }

  export class PureComponent<P = {}, S = {}> extends Component<P, S> {}

  // Ref types
  export interface RefObject<T> {
    readonly current: T | null;
  }

  export interface MutableRefObject<T> {
    current: T;
  }

  // Minimal hooks we use in the codebase
  export function createContext<T = any>(defaultValue?: T): any;
  export function useContext<T = any>(context: any): T;
  export function useEffect(effect: (...args: any[]) => any, deps?: any[]): void;
  export function useState<T = any>(initial?: T | (() => T)): [T, (v: T | ((prev: T) => T)) => void];
  export function useRef<T>(initial: T): MutableRefObject<T>;
  export function useRef<T>(initial: T | null): RefObject<T>;
  export function useRef<T = undefined>(): MutableRefObject<T | undefined>;
  export function useMemo<T>(fn: () => T, deps?: any[]): T;
  export function useCallback<T extends (...args: any[]) => any>(fn: T, deps?: any[]): T;

  // Next.js / React 18 helpers sometimes used
  export const cache: any;

  // Default export (React namespace)
  const React: any;
  export default React;
}

// Add styled-jsx support for the style element
declare namespace JSX {
  interface IntrinsicElements {
    style: {
      jsx?: boolean;
      global?: boolean;
      children?: string;
      [key: string]: any;
    };
  }
}
