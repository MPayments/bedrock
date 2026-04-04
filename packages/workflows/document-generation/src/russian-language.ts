// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./russian-nouns-js.d.ts" />
import { incline } from "lvovich";
import numberToWordsRu from "number-to-words-ru";
import RussianNouns from "russian-nouns-js";

import { formatDecimalString } from "@bedrock/shared/money";

const convertNumberToWordsRu = numberToWordsRu.convert;
const { Case, Engine, Gender, createLemma } = RussianNouns;

export type SupportedLang = "ru" | "en";

function normalizeAmountToFixedScale(
  amount: number | string,
  scale: number,
): string | null {
  try {
    return formatDecimalString(
      typeof amount === "string" ? amount.replace(/\s/g, "") : amount,
      {
        minimumFractionDigits: scale,
        maximumFractionDigits: scale,
        groupSeparator: "",
        decimalSeparator: ".",
      },
    );
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Currency symbols
// ---------------------------------------------------------------------------

const CURRENCY_SYMBOLS: Record<string, string> = {
  RUB: "₽",
  USD: "$",
  EUR: "€",
  CNY: "¥",
  TRY: "₺",
  AED: "د.إ",
};

export function getCurrencySymbol(currencyCode: string): string {
  return CURRENCY_SYMBOLS[currencyCode.toUpperCase()] || currencyCode;
}

// ---------------------------------------------------------------------------
// Money in words (Russian)
// ---------------------------------------------------------------------------

interface CurrencyWordConfig {
  integer: [string, string, string];
  fractional: [string, string, string];
  integerGender: "masculine" | "feminine";
}

const CURRENCY_WORDS: Record<string, CurrencyWordConfig> = {
  RUB: {
    integer: ["рубль", "рубля", "рублей"],
    fractional: ["копейка", "копейки", "копеек"],
    integerGender: "masculine",
  },
  USD: {
    integer: ["доллар США", "доллара США", "долларов США"],
    fractional: ["цент", "цента", "центов"],
    integerGender: "masculine",
  },
  EUR: {
    integer: ["евро", "евро", "евро"],
    fractional: ["евроцент", "евроцента", "евроцентов"],
    integerGender: "masculine",
  },
  CNY: {
    integer: ["юань", "юаня", "юаней"],
    fractional: ["фэнь", "фэня", "фэней"],
    integerGender: "masculine",
  },
  TRY: {
    integer: ["турецкая лира", "турецкие лиры", "турецких лир"],
    fractional: ["куруш", "куруша", "курушей"],
    integerGender: "feminine",
  },
  AED: {
    integer: ["дирхам ОАЭ", "дирхама ОАЭ", "дирхамов ОАЭ"],
    fractional: ["филс", "филса", "филсов"],
    integerGender: "masculine",
  },
};

function pluralize(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const lastDigit = abs % 10;
  if (abs >= 11 && abs <= 19) return forms[2];
  if (lastDigit === 1) return forms[0];
  if (lastDigit >= 2 && lastDigit <= 4) return forms[1];
  return forms[2];
}

export function formatMoneyInWords(
  amount: number | string,
  currencyCode: string,
  lang: SupportedLang = "ru",
): string {
  const normalizedAmount = normalizeAmountToFixedScale(amount, 2);

  if (!normalizedAmount) return "0";

  if (lang === "en") {
    return `${formatDecimalString(normalizedAmount, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      groupSeparator: ",",
      decimalSeparator: ".",
    })} ${currencyCode.toUpperCase()}`;
  }

  const config = CURRENCY_WORDS[currencyCode.toUpperCase()];

  if (!config) {
    const result = convertNumberToWordsRu(Number(normalizedAmount), {
      convertNumberToWords: { fractional: true },
    });
    return `${result} ${currencyCode}`;
  }

  if (currencyCode === "RUB") {
    return convertNumberToWordsRu(Number(normalizedAmount), {
      convertNumberToWords: { fractional: true },
    });
  }

  const negative = normalizedAmount.startsWith("-");
  const unsignedAmount = negative ? normalizedAmount.slice(1) : normalizedAmount;
  const [integerPartRaw = "0", fractionalPartRaw = "00"] =
    unsignedAmount.split(".");
  const integerPart = Number(integerPartRaw);
  const fractionalPart = Number(fractionalPartRaw);

  const integerWords = convertNumberToWordsRu(integerPart, {
    convertNumberToWords: { fractional: false },
  });

  const cleanIntegerWords = integerWords
    .replace(/\s*целых?\s*$/i, "")
    .trim();

  const integerNoun = pluralize(integerPart, config.integer);
  const fractionalStr = fractionalPartRaw.padStart(2, "0");
  const fractionalNoun = pluralize(fractionalPart, config.fractional);

  const capitalized =
    cleanIntegerWords.charAt(0).toUpperCase() + cleanIntegerWords.slice(1);

  const value = `${capitalized} ${integerNoun} ${fractionalStr} ${fractionalNoun}`;
  return negative ? `Минус ${value}` : value;
}

// ---------------------------------------------------------------------------
// Format currency amount (numeric formatting)
// ---------------------------------------------------------------------------

export function formatCurrencyAmount(
  totalPrice: string | number,
  divider = " ",
): string {
  if (totalPrice === null || totalPrice === undefined || totalPrice === "") {
    return "0.00";
  }

  const formatted = normalizeAmountToFixedScale(totalPrice, 2);
  if (!formatted) return "0.00";

  return formatDecimalString(formatted, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    groupSeparator: divider,
    decimalSeparator: ".",
  });
}

// ---------------------------------------------------------------------------
// Director name declension (Russian genitive case)
// ---------------------------------------------------------------------------

export function formatDirector(
  fullName: string,
  lang: SupportedLang = "ru",
): { genitive: string; initials: string } {
  if (lang !== "ru") {
    const normalized = fullName?.trim() || "";
    return { genitive: normalized, initials: normalized };
  }

  const [last = "", first = "", middle = ""] = fullName.trim().split(/\s+/);
  const g = incline({ last, first, middle }, "genitive");
  const genitive = [g.last, g.first, g.middle].filter(Boolean).join(" ");
  const initials = `${last} ${first.charAt(0)}.${middle ? middle.charAt(0) + "." : ""}`;

  return { genitive, initials };
}

// ---------------------------------------------------------------------------
// Decline basis text to genitive case (e.g. "Устав" → "Устава")
// ---------------------------------------------------------------------------

export function declineBasisToGenitive(
  basis: string,
  lang: SupportedLang = "ru",
): string {
  if (lang !== "ru") return basis;

  const m = basis.trim().match(/^([\p{L}ёЁ]+)(.*)$/u);
  if (!m) return basis;

  const firstWord = m[1]!;
  const tail = m[2] ?? "";

  const lastChar = firstWord.slice(-1).toLowerCase();
  let gender = Gender.MASCULINE;
  if (/[ая]$/.test(lastChar)) gender = Gender.FEMININE;
  else if (/[оёе]$/.test(lastChar)) gender = Gender.NEUTER;
  else if (lastChar === "ь") gender = Gender.FEMININE;

  const rne = new Engine();
  const lemma = createLemma({ text: firstWord.toLowerCase(), gender });
  const declined = rne.decline(lemma, Case.GENITIVE);
  const genRaw = declined[0] ?? firstWord.toLowerCase();

  const gen =
    firstWord[0]!.toUpperCase() === firstWord[0]
      ? genRaw[0]!.toUpperCase() + genRaw.slice(1)
      : genRaw;

  return gen + tail;
}
