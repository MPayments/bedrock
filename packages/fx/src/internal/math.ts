export function mulDivFloor(a: bigint, num: bigint, den: bigint): bigint {
    if (den <= 0n) throw new Error("rateDen must be > 0");
    return (a * num) / den;
}

function gcd(a: bigint, b: bigint): bigint {
    let x = a < 0n ? -a : a;
    let y = b < 0n ? -b : b;
    while (y !== 0n) {
        const t = y;
        y = x % y;
        x = t;
    }
    return x;
}

export function effectiveRateFromAmounts(fromAmountMinor: bigint, toAmountMinor: bigint): { rateNum: bigint; rateDen: bigint } {
    const d = gcd(toAmountMinor, fromAmountMinor);
    return {
        rateNum: toAmountMinor / d,
        rateDen: fromAmountMinor / d,
    };
}
