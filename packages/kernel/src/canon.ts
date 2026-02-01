/**
 * Canonical serialization utilities for deterministic hashing.
 * 
 * These functions ensure objects are serialized to a stable string representation
 * regardless of key insertion order, making them suitable for idempotency keys
 * and content-based addressing.
 */

/**
 * Serialize a value to a stable JSON string.
 * 
 * - Object keys are sorted alphabetically
 * - BigInt values are converted to strings
 * - Undefined values are treated as null
 * - Arrays preserve order
 */
export function stableStringify(value: unknown): string {
    if (typeof value === "bigint") {
        return JSON.stringify(value.toString());
    }
    if (typeof value === "undefined") {
        return "null";
    }
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(",")}]`;
    }

    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const pairs = keys
        .filter((k) => typeof obj[k] !== "undefined")
        .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`);
    return `{${pairs.join(",")}}`;
}

/**
 * Create a canonical plan key from an operation name and payload.
 * 
 * Plan keys are used for:
 * - Idempotency: same input produces same key
 * - Deduplication: detect duplicate transfer attempts
 * - Deterministic IDs: derive transfer IDs from plan keys
 * 
 * @param operation The operation name (e.g., "funding_settled", "fx_principal")
 * @param payload The operation payload with relevant parameters
 * @returns A canonical string key
 */
export function makePlanKey(operation: string, payload: Record<string, unknown>): string {
    return `${operation}:${stableStringify(payload)}`;
}
