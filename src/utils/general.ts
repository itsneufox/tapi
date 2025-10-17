import _path from "node:path";

/**
 * Determine whether at least one of the provided keys contains a non-empty value.
 *
 * @param repo - Object to inspect for values.
 * @param keys - Keys to validate.
 */
export function hasAtLeastOne<T extends object>(
  repo: T,
  keys: (keyof T)[]
): boolean {
  return keys.some(
    (k) => repo[k] !== undefined && repo[k] !== null && repo[k] !== ''
  );
}

/**
 * Determine whether at least two of the provided keys contain non-empty values.
 *
 * @param obj - Object to inspect for values.
 * @param keys - Keys to validate.
 */
export function hasTwoOrMore<T extends object>(
  obj: T,
  keys: (keyof T)[]
): boolean {
  return (
    keys
      .map((k) => obj[k] !== undefined && obj[k] !== null && obj[k] !== '')
      .filter(Boolean).length >= 2
  );
}
