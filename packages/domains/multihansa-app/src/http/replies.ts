import { http, type HttpRawOutput } from "@bedrock/core";

import { normalizeMoneyFields } from "./amount";
import { toJsonSafe } from "./json";

type ApiJsonOptions = {
  normalizeMoney?: boolean;
};

export const DeletedSchema = {
  deleted: true,
} as const;

export function toApiJson(value: unknown, options?: ApiJsonOptions): unknown {
  const normalized =
    options?.normalizeMoney === true ? normalizeMoneyFields(value) : value;
  return toJsonSafe(normalized);
}

export function replyJson(
  value: unknown,
  status = 200,
  options?: ApiJsonOptions,
) {
  return http.reply.status(status, toApiJson(value, options));
}

export function replyDeleted() {
  return http.reply.ok(DeletedSchema);
}

export function replyTextFile(input: {
  content: string;
  filename: string;
  contentType?: string;
}): HttpRawOutput<200> {
  return http.reply.raw(input.content, {
    status: 200,
    contentType: input.contentType ?? "text/plain; charset=utf-8",
    headers: {
      "content-disposition": `attachment; filename="${input.filename}"`,
    },
  }) as HttpRawOutput<200>;
}

export function replyWithEtag<TBody extends Record<string, unknown>>(input: {
  requestHeaders: Record<string, string>;
  body: TBody;
  status?: number;
  extractVersion: (body: TBody) => string | number | undefined;
  options?: ApiJsonOptions;
}) {
  const version = input.extractVersion(input.body);
  if (version === undefined) {
    return replyJson(input.body, input.status ?? 200, input.options);
  }

  const etag = `"${String(version)}"`;
  if (input.requestHeaders["if-none-match"] === etag) {
    return http.reply.status(304, undefined, {
      headers: {
        etag,
        "cache-control": "no-cache",
      },
    });
  }

  return http.reply.status(
    input.status ?? 200,
    toApiJson(input.body, input.options),
    {
      headers: {
        etag,
        "cache-control": "no-cache",
      },
    },
  );
}
