"use client";

import { SectionErrorState } from "@/components/section-error-state";

export default function TransfersError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SectionErrorState
      title="Не удалось загрузить переводы"
      description="Transfer workflow сейчас недоступен."
      reset={reset}
    />
  );
}
