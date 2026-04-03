import { Building2, Landmark } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import { ATTACHMENT_PURPOSE_LABELS } from "./constants";
import type { ApiCrmDealWorkbenchProjection } from "./types";

type BeneficiaryDraftCardProps = {
  beneficiaryDraft: ApiCrmDealWorkbenchProjection["beneficiaryDraft"];
};

function formatValue(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : "Не указано";
}

export function BeneficiaryDraftCard({
  beneficiaryDraft,
}: BeneficiaryDraftCardProps) {
  if (!beneficiaryDraft) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Черновик получателя</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Черновик появится после успешного распознавания инвойса или договора.
        </CardContent>
      </Card>
    );
  }

  const beneficiary = beneficiaryDraft.beneficiarySnapshot;
  const bank = beneficiaryDraft.bankInstructionSnapshot;
  const purposeLabel = beneficiaryDraft.purpose
    ? ATTACHMENT_PURPOSE_LABELS[beneficiaryDraft.purpose]
    : "Файл";

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Черновик получателя</CardTitle>
          <Badge variant="outline">{purposeLabel}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Данные извлечены из загруженного файла. Пустые поля анкеты система уже
          подставила автоматически.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-3">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            Получатель
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Юридическое название</dt>
              <dd>{formatValue(beneficiary?.legalName)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Короткое название</dt>
              <dd>{formatValue(beneficiary?.displayName)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">ИНН / налоговый номер</dt>
              <dd>{formatValue(beneficiary?.inn)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Страна</dt>
              <dd>{formatValue(beneficiary?.country)}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border p-3">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Landmark className="h-4 w-4 text-muted-foreground" />
            Банковские реквизиты
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Банк</dt>
              <dd>{formatValue(bank?.bankName)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Страна банка</dt>
              <dd>{formatValue(bank?.bankCountry)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Получатель</dt>
              <dd>{formatValue(bank?.beneficiaryName)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Счет</dt>
              <dd>{formatValue(bank?.accountNo ?? bank?.iban)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">SWIFT / BIC</dt>
              <dd>{formatValue(bank?.swift ?? bank?.bic)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Корр. счет</dt>
              <dd>{formatValue(bank?.corrAccount)}</dd>
            </div>
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}
