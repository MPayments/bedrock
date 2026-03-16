"use client";

import { SectionErrorState } from "@/components/section-error-state";

export default function FxError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SectionErrorState
      title="Не удалось загрузить FX-раздел"
      description="Данные по курсам и источникам сейчас недоступны."
      reset={reset}
    />
  );
}
