"use client";

import { SectionErrorState } from "@/components/section-error-state";

export default function PaymentsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SectionErrorState
      title="Не удалось загрузить платежи"
      description="Платежный workspace временно недоступен."
      reset={reset}
    />
  );
}
