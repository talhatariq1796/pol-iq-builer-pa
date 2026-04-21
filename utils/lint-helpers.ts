/**
 * Utility functions to help fix common linter issues
 */

/**
 * Safely check if an object has a property without triggering the no-prototype-builtins rule
 * Use this instead of object.hasOwnProperty('key')
 */
export function hasOwnProperty<T extends object>(obj: T, prop: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

/**
 * Safely get a property from an object if it exists
 */
export function getProperty<T extends object, K extends PropertyKey>(
  obj: T, 
  prop: K
): unknown {
  return hasOwnProperty(obj, prop) ? (obj as any)[prop] : undefined;
}

/**
 * Safely check if an element exists in an array
 * Use this as a type guard
 */
export function isElementInArray<T>(arr: T[], elem: unknown): elem is T {
  return arr.includes(elem as T);
}

/**
 * Escape special characters in a string for JSX
 */
export function escapeJSX(str: string): string {
  return str
    .replace(/'/g, "&apos;")
    .replace(/"/g, "&quot;");
} 