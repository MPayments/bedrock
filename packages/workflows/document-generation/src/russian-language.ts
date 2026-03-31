import { incline } from "lvovich";
import numberToWordsRu from "number-to-words-ru";
import RussianNouns from "russian-nouns-js";

const convertNumberToWordsRu = numberToWordsRu.convert;
const { Case, Engine, Gender, createLemma } = RussianNouns;

export type SupportedLang = "ru" | "en";

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
  if (lang === "en") {
    const numericAmount =
      typeof amount === "string"
        ? parseFloat(amount.replace(/\s/g, "").replace(",", "."))
        : amount;
    if (!Number.isFinite(numericAmount)) return "0";
    return `${new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericAmount)} ${currencyCode.toUpperCase()}`;
  }

  const numericAmount =
    typeof amount === "string"
      ? parseFloat(amount.replace(/\s/g, "").replace(",", "."))
      : amount;

  if (!Number.isFinite(numericAmount)) return "0";

  const config = CURRENCY_WORDS[currencyCode.toUpperCase()];

  if (!config) {
    const result = convertNumberToWordsRu(numericAmount, {
      convertNumberToWords: { fractional: true },
    });
    return `${result} ${currencyCode}`;
  }

  if (currencyCode === "RUB") {
    return convertNumberToWordsRu(numericAmount, {
      convertNumberToWords: { fractional: true },
    });
  }

  const roundedAmount = Math.round(numericAmount * 100) / 100;
  const integerPart = Math.floor(Math.abs(roundedAmount));
  const fractionalPart = Math.round(
    (Math.abs(roundedAmount) - integerPart) * 100,
  );

  const integerWords = convertNumberToWordsRu(integerPart, {
    convertNumberToWords: { fractional: false },
  });

  const cleanIntegerWords = integerWords
    .replace(/\s*целых?\s*$/i, "")
    .trim();

  const integerNoun = pluralize(integerPart, config.integer);
  const fractionalStr = fractionalPart.toString().padStart(2, "0");
  const fractionalNoun = pluralize(fractionalPart, config.fractional);

  const capitalized =
    cleanIntegerWords.charAt(0).toUpperCase() + cleanIntegerWords.slice(1);

  return `${capitalized} ${integerNoun} ${fractionalStr} ${fractionalNoun}`;
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

  const numericValue =
    typeof totalPrice === "number"
      ? totalPrice
      : parseFloat(String(totalPrice).replace(",", "."));

  if (!Number.isFinite(numericValue)) return "0.00";

  const roundedValue = Math.round(numericValue * 100) / 100;
  const [integerPart = "0", decimalPart = "00"] = roundedValue.toFixed(2).split(".");
  const reversedDigits = [...integerPart].reverse();
  const groupedDigits: string[] = [];

  for (let index = 0; index < reversedDigits.length; index += 1) {
    groupedDigits.push(reversedDigits[index]!);
    if ((index + 1) % 3 === 0 && index !== reversedDigits.length - 1) {
      groupedDigits.push(divider);
    }
  }

  const formattedInteger = groupedDigits.reverse().join("");

  return `${formattedInteger}.${decimalPart}`;
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
