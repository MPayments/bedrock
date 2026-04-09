import { z, type ZodTypeAny } from "zod";

export interface HttpResponseLike {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

export async function parseJsonSafely(
  response: HttpResponseLike,
): Promise<unknown | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function readJsonWithSchema<TSchema extends ZodTypeAny>(
  response: HttpResponseLike,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  const payload = await parseJsonSafely(response);
  return schema.parse(payload);
}
