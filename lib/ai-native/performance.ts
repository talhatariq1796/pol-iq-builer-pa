import { useRef, useCallback, useEffect, useState, useMemo } from 'react';


export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    }) as T,
    [delay]
  );
}

export function useThrottle<T>(value: T, interval: number): T {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastUpdated = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();
    if (now - lastUpdated.current >= interval) {
      lastUpdated.current = now;
      setThrottledValue(value);
    } else {
      const timer = setTimeout(() => {
        lastUpdated.current = Date.now();
        setThrottledValue(value);
      }, interval - (now - lastUpdated.current));
      return () => clearTimeout(timer);
    }
  }, [value, interval]);

  return throttledValue;
}

export function useThrottledCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  interval: number
): T {
  const lastCalledRef = useRef(0);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCalledRef.current >= interval) {
        lastCalledRef.current = now;
        callbackRef.current(...args);
      }
    }) as T,
    [interval]
  );
}

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

export class MemoCache<K, V> {
  private cache = new Map<string, CacheEntry<V>>();
  private ttl: number;
  private maxSize: number;

  constructor(options: { ttl?: number; maxSize?: number } = {}) {
    this.ttl = options.ttl ?? 5 * 60 * 1000; // 5 minutes default
    this.maxSize = options.maxSize ?? 100;
  }

  private getKey(key: K): string {
    return typeof key === 'string' ? key : JSON.stringify(key);
  }

  get(key: K): V | undefined {
    const strKey = this.getKey(key);
    const entry = this.cache.get(strKey);

    if (!entry) return undefined;

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(strKey);
      return undefined;
    }

    return entry.value;
  }

  set(key: K, value: V): void {
    const strKey = this.getKey(key);

    // Enforce max size
    if (this.cache.size >= this.maxSize && !this.cache.has(strKey)) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }

    this.cache.set(strKey, {
      value,
      timestamp: Date.now(),
    });
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): void {
    this.cache.delete(this.getKey(key));
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export function useMemoWithTTL<T>(
  factory: () => T,
  deps: unknown[],
  ttl: number
): T {
  const cacheRef = useRef<{ value: T; deps: unknown[]; timestamp: number } | null>(null);

  return useMemo(() => {
    const now = Date.now();

    // Check if cache is valid
    if (cacheRef.current) {
      const depsMatch = deps.every((dep, i) => dep === cacheRef.current!.deps[i]);
      const notExpired = now - cacheRef.current.timestamp < ttl;

      if (depsMatch && notExpired) {
        return cacheRef.current.value;
      }
    }

    // Compute new value
    const value = factory();
    cacheRef.current = { value, deps, timestamp: now };
    return value;
  }, [...deps, ttl]);
}

export interface VirtualScrollConfig {
  itemCount: number;
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}

export interface VirtualScrollResult {
  startIndex: number;
  endIndex: number;
  visibleCount: number;
  totalHeight: number;
  offsetTop: number;
}

export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): {
  ref: React.RefCallback<Element>;
  isIntersecting: boolean;
  entry: IntersectionObserverEntry | null;
} {
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const ref = useCallback(
    (node: Element | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      if (node) {
        observerRef.current = new IntersectionObserver(
          ([entry]) => setEntry(entry),
          options
        );
        observerRef.current.observe(node);
      }
    },
    [options.root, options.rootMargin, options.threshold]
  );

  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return {
    ref,
    isIntersecting: entry?.isIntersecting ?? false,
    entry,
  };
}

export function useLazyLoad<T>(
  loader: () => Promise<T>,
  options: {
    immediate?: boolean;
    onLoad?: (data: T) => void;
    onError?: (error: Error) => void;
  } = {}
): {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  load: () => Promise<void>;
  reset: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const loadedRef = useRef(false);

  const load = useCallback(async () => {
    if (loadedRef.current || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await loader();
      setData(result);
      loadedRef.current = true;
      options.onLoad?.(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      options.onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [loader, isLoading]);

  const reset = useCallback(() => {
    setData(null);
    setIsLoading(false);
    setError(null);
    loadedRef.current = false;
  }, []);

  useEffect(() => {
    if (options.immediate) {
      load();
    }
  }, []);

  return { data, isLoading, error, load, reset };
}

export class PreloadManager {
  private static instance: PreloadManager;
  private preloadedResources = new Set<string>();
  private preloadPromises = new Map<string, Promise<unknown>>();

  private constructor() { }

  static getInstance(): PreloadManager {
    if (!PreloadManager.instance) {
      PreloadManager.instance = new PreloadManager();
    }
    return PreloadManager.instance;
  }

  preloadImage(src: string): Promise<void> {
    if (this.preloadedResources.has(src)) {
      return Promise.resolve();
    }

    const existing = this.preloadPromises.get(src);
    if (existing) return existing as Promise<void>;

    const promise = new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.preloadedResources.add(src);
        resolve();
      };
      img.onerror = reject;
      img.src = src;
    });

    this.preloadPromises.set(src, promise);
    return promise;
  }

  preloadScript(src: string): Promise<void> {
    if (this.preloadedResources.has(src)) {
      return Promise.resolve();
    }

    const existing = this.preloadPromises.get(src);
    if (existing) return existing as Promise<void>;

    const promise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => {
        this.preloadedResources.add(src);
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });

    this.preloadPromises.set(src, promise);
    return promise;
  }

  preloadData<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const existing = this.preloadPromises.get(key);
    if (existing) return existing as Promise<T>;

    const promise = fetcher().then(data => {
      this.preloadedResources.add(key);
      return data;
    });

    this.preloadPromises.set(key, promise);
    return promise;
  }

  isPreloaded(key: string): boolean {
    return this.preloadedResources.has(key);
  }

  clear(): void {
    this.preloadedResources.clear();
    this.preloadPromises.clear();
  }
}

export function useRAFCallback<T extends (...args: unknown[]) => unknown>(
  callback: T
): T {
  const rafRef = useRef<number>();
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return useCallback(
    ((...args: Parameters<T>) => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(() => {
        callbackRef.current(...args);
      });
    }) as T,
    []
  );
}

export function useBatchedUpdates<T>(
  updates: T[],
  batchSize: number,
  delay: number
): T[] {
  const [processedUpdates, setProcessedUpdates] = useState<T[]>([]);
  const queueRef = useRef<T[]>([]);
  const processingRef = useRef(false);

  useEffect(() => {
    queueRef.current = [...queueRef.current, ...updates];

    if (!processingRef.current && queueRef.current.length > 0) {
      processingRef.current = true;

      const processBatch = () => {
        const batch = queueRef.current.splice(0, batchSize);
        if (batch.length > 0) {
          setProcessedUpdates((prev: T[]) => [...prev, ...batch]);
        }

        if (queueRef.current.length > 0) {
          setTimeout(processBatch, delay);
        } else {
          processingRef.current = false;
        }
      };

      processBatch();
    }
  }, [updates, batchSize, delay]);

  return processedUpdates;
}

export const preloadManager = PreloadManager.getInstance();
