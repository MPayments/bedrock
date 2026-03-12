import { z, type ZodTypeAny } from "zod";

import { resolveApiErrorMessage } from "@/lib/api-error";

export const ApiErrorPayloadSchema = z
  .object({
    error: z.string().optional(),
    message: z.string().optional(),
    details: z.unknown().optional(),
  })
  .passthrough();

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload: unknown,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

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

export async function requestOk(
  response: HttpResponseLike,
  context: string,
): Promise<HttpResponseLike> {
  if (response.ok) {
    return response;
  }

  const payload = await parseJsonSafely(response);
  throw new ApiRequestError(
    resolveApiErrorMessage(response.status, payload, context),
    response.status,
    payload,
  );
}

export async function readJsonWithSchema<TSchema extends ZodTypeAny>(
  response: HttpResponseLike,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  const payload = await parseJsonSafely(response);
  return schema.parse(payload);
}
