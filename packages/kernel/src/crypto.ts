import { createHash } from "node:crypto";

/**
 * Compute SHA-256 hash of a string and return as hex.
 */
export function sha256Hex(input: string): string {
    return createHash("sha256").update(input).digest("hex");
}
