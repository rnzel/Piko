/**
 * Recursively removes all undefined values from an object/array.
 * Firestore rejects undefined field values; this ensures only valid data is written.
 *
 * - Plain objects: keys with undefined values are deleted
 * - Arrays: each element is sanitized recursively
 * - Special objects (Date, Firebase FieldValue, etc.): returned unchanged
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return undefined as any;
  }

  // Handle Firestore sentinel objects (e.g., FieldValue.serverTimestamp())
  // They are non-plain objects with a specific prototype/constructor
  if (
    data !== null &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    data.constructor !== Object &&
    typeof (data as any).isEqual === "function" // Firestore FieldValue has isEqual
  ) {
    return data; // Firestore special value — pass through
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as any;
  }

  if (data !== null && typeof data === "object") {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (value !== undefined) {
        result[key] = sanitizeForFirestore(value);
      }
    }
    return result as T;
  }

  // primitives (string, number, boolean, null, symbol, bigint) pass through
  return data;
}