import { API_BASE_URL } from "./constants";

export async function translateFieldsToEnglish(
  fields: Record<string, string>
): Promise<Record<string, string>> {
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value && value.trim()) {
      filtered[key] = value;
    }
  }

  if (Object.keys(filtered).length === 0) {
    return {};
  }

  const res = await fetch(`/v1/ai/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ fields: filtered }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Ошибка перевода: ${res.status}`
    );
  }

  return res.json();
}
