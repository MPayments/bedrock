import { type ZodType } from "zod";

import { resolveApiErrorMessage } from "@/lib/api-error";

import {
  parseJsonSafely,
  readJsonWithSchema,
  type HttpResponseLike,
} from "./response";

export type ApiMutationResult<T> =
  | {
      ok: true;
      data: T;
      response: HttpResponseLike;
    }
  | {
      ok: false;
      message: string;
      status?: number;
    };

export async function executeApiMutation<T>({
  request,
  schema,
  fallbackMessage,
}: {
  request: () => Promise<HttpResponseLike>;
  schema: ZodType<T>;
  fallbackMessage: string;
}): Promise<ApiMutationResult<T>> {
  try {
    const response = await request();

    if (!response.ok) {
      const payload = await parseJsonSafely(response);
      return {
        ok: false,
        status: response.status,
        message: resolveApiErrorMessage(
          response.status,
          payload,
          fallbackMessage,
        ),
      };
    }

    const data = await readJsonWithSchema(response, schema);

    return {
      ok: true,
      data,
      response,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : fallbackMessage,
    };
  }
}
