import type { useRouter } from "next/navigation";

export function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function refreshPage(router: ReturnType<typeof useRouter>) {
  router.refresh();
}
