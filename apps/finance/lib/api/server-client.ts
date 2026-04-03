import "server-only";

import { cache } from "react";
import { headers } from "next/headers";

import { createClient } from "@bedrock/sdk-api-client";

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:3000";

const createServerApiClient = async () => {
  const requestHeaders = await headers();

  return createClient(API_URL, {
    headers: {
      cookie: requestHeaders.get("cookie") ?? "",
      "x-bedrock-app-audience": "finance",
    },
    init: {
      cache: "no-store",
    },
  });
};

export const getServerApiClient = cache(createServerApiClient);
