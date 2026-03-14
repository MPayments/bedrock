import "server-only";

import { cache } from "react";
import { headers } from "next/headers";

import { createClient, type Client } from "@bedrock/sdk-api-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

const createServerApiClient = async (): Promise<Client> => {
  const requestHeaders = await headers();

  return createClient(API_URL, {
    headers: {
      cookie: requestHeaders.get("cookie") ?? "",
    },
    init: {
      cache: "no-store",
    },
  });
};

export const getServerApiClient = cache(createServerApiClient);
