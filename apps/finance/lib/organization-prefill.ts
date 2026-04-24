export type OrganizationInnLookupResult = {
  address?: string;
  addressDetails?: string;
  city?: string;
  directorBasis?: string;
  directorName?: string;
  inn?: string;
  kpp?: string;
  ogrn?: string;
  okpo?: string;
  oktmo?: string;
  orgName?: string;
  orgType?: string;
  position?: string;
  postalCode?: string;
  streetAddress?: string;
};

export type OrganizationCardParseResult = OrganizationInnLookupResult & {
  account?: string;
  bankAddress?: string;
  bankCountry?: string;
  bankName?: string;
  bic?: string;
  email?: string;
  phone?: string;
  swift?: string;
};

function getResponseErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const record = payload as Record<string, unknown>;
  return (
    (typeof record.message === "string" && record.message) ||
    (typeof record.error === "string" && record.error) ||
    fallback
  );
}

function pickStringFields<TResult extends Record<string, string | undefined>>(
  source: Record<string, unknown>,
  keys: readonly (keyof TResult & string)[],
): TResult {
  const result: Record<string, string> = {};
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.length > 0) {
      result[key] = value;
    }
  }
  return result as TResult;
}

const INN_LOOKUP_FIELDS = [
  "address",
  "addressDetails",
  "city",
  "directorBasis",
  "directorName",
  "inn",
  "kpp",
  "ogrn",
  "okpo",
  "oktmo",
  "orgName",
  "orgType",
  "position",
  "postalCode",
  "streetAddress",
] as const;

const CARD_PARSE_FIELDS = [
  ...INN_LOOKUP_FIELDS,
  "account",
  "bankAddress",
  "bankCountry",
  "bankName",
  "bic",
  "email",
  "phone",
  "swift",
] as const;

// Reuses counterparty endpoints — DaData + LLM responses are company-generic.
export async function lookupOrganizationByInn(
  inn: string,
): Promise<OrganizationInnLookupResult> {
  const trimmed = inn.trim();

  if (!trimmed) {
    throw new Error("Введите ИНН для поиска");
  }

  if (!/^\d{10,12}$/.test(trimmed)) {
    throw new Error("ИНН должен содержать 10 или 12 цифр");
  }

  const response = await fetch(
    `/v1/counterparties/lookup-by-inn?inn=${encodeURIComponent(trimmed)}`,
    {
      credentials: "include",
    },
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      getResponseErrorMessage(errorData, `Ошибка поиска: ${response.status}`),
    );
  }

  const payload = (await response.json()) as Record<string, unknown> | null;
  if (!payload || typeof payload !== "object") {
    throw new Error("Организация с таким ИНН не найдена");
  }

  return pickStringFields<OrganizationInnLookupResult>(
    payload,
    INN_LOOKUP_FIELDS,
  );
}

export async function parseOrganizationCardPdf(
  file: File,
): Promise<OrganizationCardParseResult> {
  if (file.type !== "application/pdf") {
    throw new Error("Поддерживается только PDF формат");
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`/v1/counterparties/parse-card`, {
    body: formData,
    credentials: "include",
    method: "POST",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      getResponseErrorMessage(
        errorData,
        `Ошибка распознавания: ${response.status}`,
      ),
    );
  }

  const payload = (await response.json()) as Record<string, unknown> | null;
  if (!payload || typeof payload !== "object") {
    throw new Error("Не удалось распознать файл");
  }

  return pickStringFields<OrganizationCardParseResult>(
    payload,
    CARD_PARSE_FIELDS,
  );
}
