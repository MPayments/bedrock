import { type FxRateSource } from "../sources/types";

const RUB_ORDER: FxRateSource[] = ["cbr", "xe", "investing"];
const USD_ORDER: FxRateSource[] = ["xe", "cbr", "investing"];
const DEFAULT_ORDER: FxRateSource[] = ["investing", "cbr", "xe"];

export function getSourceOrder(base: string, quote: string): FxRateSource[] {
    const upper = [base.toUpperCase(), quote.toUpperCase()];
    if (upper.includes("RUB")) return RUB_ORDER;
    if (upper.includes("USD")) return USD_ORDER;
    return DEFAULT_ORDER;
}
