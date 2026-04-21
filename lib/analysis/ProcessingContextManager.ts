import { ProcessingContext } from './types';

/**
 * ProcessingContextManager
 * ------------------------
 * Singleton used to share the active ProcessingContext across processor calls.
 * Processors can retrieve the current context without each endpoint-specific
 * implementation wiring its own context plumbing.
 */
export class ProcessingContextManager {
  private static instance: ProcessingContextManager | null = null;
  private currentContext: ProcessingContext | null = null;

  private constructor() {}

  public static getInstance(): ProcessingContextManager {
    if (!ProcessingContextManager.instance) {
      ProcessingContextManager.instance = new ProcessingContextManager();
    }
    return ProcessingContextManager.instance;
  }

  public getContext(): ProcessingContext | null {
    return this.currentContext;
  }

  public setContext(context: ProcessingContext | null): void {
    this.currentContext = context;
  }
}
