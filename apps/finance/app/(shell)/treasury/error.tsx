"use client";

import { SectionErrorState } from "@/components/section-error-state";

export default function TreasuryError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SectionErrorState
      title="Не удалось загрузить казначейство"
      description="Казначейский раздел сейчас недоступен."
      reset={reset}
    />
  );
}
