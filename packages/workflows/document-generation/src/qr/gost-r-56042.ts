export interface GostPayloadInput {
  name: string;
  personalAcc: string;
  bankName: string;
  bic: string;
  correspAcc: string;
  sum?: string | number;
  payeeINN?: string;
  kpp?: string;
  purpose?: string;
  docNo?: string;
  docDate?: string;
}

const HEADER = "ST00012";

const MAX_LENGTH: Record<string, number> = {
  Name: 160,
  BankName: 45,
  Purpose: 210,
  DocNo: 15,
};

const FIELD_ORDER = [
  "Name",
  "PersonalAcc",
  "BankName",
  "BIC",
  "CorrespAcc",
  "Sum",
  "PayeeINN",
  "KPP",
  "Purpose",
  "DocNo",
  "DocDate",
] as const;

const DIGITS_RE = /^\d+$/;

function sanitize(value: string): string {
  return value.replace(/[|=]/g, " ");
}

function truncate(value: string, max: number | undefined): string {
  if (max == null) return value;
  return Array.from(value).slice(0, max).join("");
}

function normalizeSumToKopecks(sum: string | number): string {
  if (typeof sum === "number") {
    if (!Number.isFinite(sum)) {
      throw new Error("Gost56042: sum is not a finite number");
    }
    if (sum < 0) {
      throw new Error("Gost56042: sum must be non-negative");
    }
    return Math.round(sum * 100).toString();
  }

  const trimmed = sum.trim();
  if (trimmed === "") {
    throw new Error("Gost56042: sum is empty string");
  }
  const numeric = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(numeric)) {
    throw new Error(`Gost56042: sum is not a number: ${sum}`);
  }
  if (numeric < 0) {
    throw new Error("Gost56042: sum must be non-negative");
  }
  return Math.round(numeric * 100).toString();
}

function assertDigits(value: string, length: number, field: string): void {
  if (!DIGITS_RE.test(value) || value.length !== length) {
    throw new Error(
      `Gost56042: ${field} must be ${length} digits, got "${value}"`,
    );
  }
}

function assertInn(value: string): void {
  if (!DIGITS_RE.test(value) || (value.length !== 10 && value.length !== 12)) {
    throw new Error(`Gost56042: PayeeINN must be 10 or 12 digits, got "${value}"`);
  }
}

export function formatGost56042Payload(input: GostPayloadInput): string {
  if (!input.name) throw new Error("Gost56042: name is required");
  if (!input.personalAcc) throw new Error("Gost56042: personalAcc is required");
  if (!input.bankName) throw new Error("Gost56042: bankName is required");
  if (!input.bic) throw new Error("Gost56042: bic is required");
  if (!input.correspAcc) throw new Error("Gost56042: correspAcc is required");

  assertDigits(input.bic, 9, "BIC");
  assertDigits(input.personalAcc, 20, "PersonalAcc");
  assertDigits(input.correspAcc, 20, "CorrespAcc");

  if (input.payeeINN != null && input.payeeINN !== "") {
    assertInn(input.payeeINN);
  }
  if (input.kpp != null && input.kpp !== "") {
    assertDigits(input.kpp, 9, "KPP");
  }

  const values: Partial<Record<(typeof FIELD_ORDER)[number], string>> = {
    Name: truncate(sanitize(input.name), MAX_LENGTH.Name),
    PersonalAcc: input.personalAcc,
    BankName: truncate(sanitize(input.bankName), MAX_LENGTH.BankName),
    BIC: input.bic,
    CorrespAcc: input.correspAcc,
  };

  if (input.sum != null && input.sum !== "") {
    values.Sum = normalizeSumToKopecks(input.sum);
  }
  if (input.payeeINN != null && input.payeeINN !== "") {
    values.PayeeINN = input.payeeINN;
  }
  if (input.kpp != null && input.kpp !== "") {
    values.KPP = input.kpp;
  }
  if (input.purpose != null && input.purpose !== "") {
    values.Purpose = truncate(sanitize(input.purpose), MAX_LENGTH.Purpose);
  }
  if (input.docNo != null && input.docNo !== "") {
    values.DocNo = truncate(sanitize(input.docNo), MAX_LENGTH.DocNo);
  }
  if (input.docDate != null && input.docDate !== "") {
    values.DocDate = sanitize(input.docDate);
  }

  const parts = [HEADER];
  for (const key of FIELD_ORDER) {
    const v = values[key];
    if (v == null) continue;
    parts.push(`${key}=${v}`);
  }
  return parts.join("|");
}
