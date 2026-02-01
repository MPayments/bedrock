export function stableStringify(v: any): string {
    if (typeof v === "bigint") return JSON.stringify(v.toString());
    if (typeof v === "undefined") return "null";
    if (v === null || typeof v !== "object") return JSON.stringify(v);
    if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;

    const keys = Object.keys(v).sort();
    return `{${keys
        .filter((k) => typeof v[k] !== "undefined")
        .map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`)
        .join(",")}}`;
}

export function makePlanKey(op: string, payload: any): string {
    return `${op}:${stableStringify(payload)}`;
}
