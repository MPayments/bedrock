export async function translateFieldsToEnglish(
  fields: Record<string, string>,
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

  const response = await fetch("/v1/ai/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ fields: filtered }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Ошибка перевода: ${response.status}`,
    );
  }

  return response.json();
}
