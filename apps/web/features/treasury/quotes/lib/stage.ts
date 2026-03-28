import type { DocumentDetailsDto } from "@/features/operations/documents/lib/schemas";

import { getFxQuoteStatusLabel } from "./presentation";

export type FxQuoteStageView = {
  badgeLabel: string;
  badgeVariant:
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "success"
    | "warning";
  title: string;
  description: string;
  nextAction: string;
  contextLabel: string;
};

export function presentFxQuoteStage(input: {
  quote: {
    status: "active" | "used" | "expired" | "cancelled";
    usedByRef: string | null;
  };
  linkedDocument: DocumentDetailsDto | null;
}): FxQuoteStageView {
  const linkedDocNo = input.linkedDocument?.document.docNo ?? null;

  if (input.linkedDocument) {
    const document = input.linkedDocument.document;

    if (document.lifecycleStatus === "cancelled") {
      return {
        badgeLabel: "Сценарий отменен",
        badgeVariant: "destructive",
        title: "FX документ отменен",
        description:
          "Котировка уже была использована, но supporting FX документ отменен и дальше не исполняется.",
        nextAction:
          "Если конверсия все еще нужна, оформите новый FX с новой котировкой.",
        contextLabel: linkedDocNo
          ? `Связанный документ: ${linkedDocNo}`
          : "Связанный FX документ отменен",
      };
    }

    if (document.approvalStatus === "rejected") {
      return {
        badgeLabel: "Отклонено",
        badgeVariant: "destructive",
        title: "FX остановлен на согласовании",
        description:
          "Котировка уже занята документом, но документ отклонен и не дошел до финального оформления.",
        nextAction:
          "Откройте документ, исправьте причину отклонения или оформите новый FX.",
        contextLabel: linkedDocNo
          ? `Связанный документ: ${linkedDocNo}`
          : "Документ отклонен",
      };
    }

    if (document.postingStatus === "failed") {
      return {
        badgeLabel: "Ошибка проведения",
        badgeVariant: "destructive",
        title: "FX документ не проведен",
        description:
          "Конверсия оформлена, но учетная фиксация завершилась ошибкой и сценарий требует разбора.",
        nextAction:
          "Проверьте связанный документ и журнал, затем устраните ошибку проведения.",
        contextLabel: linkedDocNo
          ? `Связанный документ: ${linkedDocNo}`
          : "Проведение завершилось ошибкой",
      };
    }

    if (document.submissionStatus === "draft") {
      return {
        badgeLabel: "Черновик",
        badgeVariant: "secondary",
        title: "FX оформлен как черновик",
        description:
          "Котировка уже использована для FX документа, но сам документ еще не отправлен дальше по процессу.",
        nextAction:
          "Откройте документ и завершите оформление, если конверсия должна идти дальше.",
        contextLabel: linkedDocNo
          ? `Связанный документ: ${linkedDocNo}`
          : "Связан черновик FX документа",
      };
    }

    if (document.postingStatus === "posting") {
      return {
        badgeLabel: "Проведение",
        badgeVariant: "default",
        title: "FX в процессе проведения",
        description:
          "Документ уже оформлен, а система сейчас доводит его до финальной учетной фиксации.",
        nextAction:
          "Дождитесь завершения проведения или откройте журнал, если состояние слишком долго не меняется.",
        contextLabel: linkedDocNo
          ? `Связанный документ: ${linkedDocNo}`
          : "Документ находится в проведении",
      };
    }

    if (document.postingStatus === "posted") {
      return {
        badgeLabel: "FX завершен",
        badgeVariant: "success",
        title: "FX документ проведен",
        description:
          "Котировка использована, supporting FX документ оформлен и уже зафиксирован в учете.",
        nextAction:
          "Дополнительных действий не требуется, кроме проверки журнала или документа при аудите.",
        contextLabel: linkedDocNo
          ? `Связанный документ: ${linkedDocNo}`
          : "Документ успешно проведен",
      };
    }

    return {
      badgeLabel: "Документ оформлен",
      badgeVariant: "default",
      title: "FX ожидает финального учета",
      description:
        "Котировка уже использована и FX документ существует, но финальная учетная фиксация еще не завершена.",
      nextAction:
        "Проверьте дальнейшее проведение документа и связанный журнал.",
      contextLabel: linkedDocNo
        ? `Связанный документ: ${linkedDocNo}`
        : "FX документ создан",
    };
  }

  if (input.quote.status === "active") {
    return {
      badgeLabel: "Котировка активна",
      badgeVariant: "default",
      title: "FX еще не оформлен",
      description:
        "Quote уже рассчитан и может быть использован для создания FX документа, пока срок действия не истек.",
      nextAction:
        "Если конверсия подтверждена, оформите FX документ по этой котировке.",
      contextLabel: "Пока без связанного FX документа",
    };
  }

  if (input.quote.status === "expired") {
    return {
      badgeLabel: "Истекла",
      badgeVariant: "destructive",
      title: "Нужна новая котировка",
      description:
        "Срок действия quote закончился. Использовать ее для нового FX-сценария больше нельзя.",
      nextAction:
        "Создайте новую котировку и заново оформите FX, если конверсия все еще нужна.",
      contextLabel: "Связанный FX документ не найден",
    };
  }

  if (input.quote.status === "cancelled") {
    return {
      badgeLabel: "Отменена",
      badgeVariant: "outline",
      title: "Котировка отменена",
      description:
        "Quote была отменена и больше не используется как рабочая основа для FX.",
      nextAction:
        "Если конверсия остается актуальной, используйте новую котировку.",
      contextLabel: "Связанный FX документ не найден",
    };
  }

  return {
    badgeLabel: getFxQuoteStatusLabel(input.quote.status),
    badgeVariant: "secondary",
    title: "Котировка помечена как использованная",
    description:
      "Quote уже зарезервирована за FX-сценарием, но supporting FX документ не найден в текущем read model.",
    nextAction:
      "Проверьте usedByRef и связанные документы, если нужен аудит или разбор расхождения.",
    contextLabel: input.quote.usedByRef
      ? `usedByRef: ${input.quote.usedByRef}`
      : "Связанный FX документ не найден",
  };
}
