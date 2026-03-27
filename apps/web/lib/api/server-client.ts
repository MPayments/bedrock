import "server-only";

import { cache } from "react";
import { headers } from "next/headers";

import { createClient, type Client } from "@bedrock/sdk-api-client";

import { resolveInternalApiBaseUrl } from "./internal-base-url";

const createServerApiClient = async (): Promise<Client> => {
  const requestHeaders = await headers();

  return createClient(resolveInternalApiBaseUrl(), {
    headers: {
      cookie: requestHeaders.get("cookie") ?? "",
    },
    init: {
      cache: "no-store",
    },
  });
};

export const getServerApiClient = cache(createServerApiClient);
