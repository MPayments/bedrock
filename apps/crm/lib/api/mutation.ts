import { parseJsonSafely, type HttpResponseLike } from "./response";

type ApiMutationResult<T> =
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

function resolveApiErrorMessage(
  status: number,
  payload: unknown,
  fallbackMessage: string,
) {
  if (payload && typeof payload === "object") {
    const error =
      "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "message" in payload && typeof payload.message === "string"
          ? payload.message
          : null;

    if (error) {
      return error;
    }
  }

  if (status === 404) {
    return "Ресурс не найден";
  }

  return fallbackMessage;
}

export async function executeApiMutation<T>({
  request,
  fallbackMessage,
  parseData,
}: {
  request: () => Promise<HttpResponseLike>;
  fallbackMessage: string;
  parseData?: (response: HttpResponseLike) => Promise<T>;
}): Promise<ApiMutationResult<T>> {
  const parse =
    parseData ?? (async (response) => (await response.json()) as T);

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

    return {
      ok: true,
      data: await parse(response),
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
