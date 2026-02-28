"use client";

import { SectionErrorState } from "@/components/section-error-state";

export default function AccountingError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SectionErrorState
      title="Не удалось загрузить бухгалтерию"
      description="Повторите попытку или проверьте доступность API и прав доступа."
      reset={reset}
    />
  );
}
