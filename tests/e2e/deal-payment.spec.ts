import { expect, test, type Page } from "@playwright/test";

import {
  PAYMENT_DEAL_FINANCE_AUTH_FILE,
  PAYMENT_DEAL_FINANCE_BASE_URL,
  PAYMENT_DEAL_INVOICE_FILE,
  paymentDealInput,
  pickCommandItem,
  pickListboxOption,
  pickSelectItem,
} from "./deal-payment.fixture";

const DEAL_LEG_DONE_LABEL = "Завершен";
const DEAL_LEG_STATE_LABELS: Record<string, string> = {
  blocked: "Заблокирован",
  completed: "Завершен",
  done: "Завершен",
  in_progress: "В работе",
  not_materialized: "Не создан",
  pending: "Ожидает",
  processing: "В обработке",
  ready: "Подготовлен",
  skipped: "Пропущен",
};

function buildFinanceDealUrl(
  dealId: string,
  _tab: "documents" | "execution" = "execution",
) {
  return `${PAYMENT_DEAL_FINANCE_BASE_URL}/treasury/deals/${dealId}`;
}

function buildFinanceDealTabUrlPattern(
  dealId: string,
  _tab: "documents" | "execution",
) {
  return new RegExp(`/treasury/deals/${dealId}(?:\\?.*)?$`, "i");
}

function extractTrailingUuid(url: string) {
  const match = url.match(/\/([0-9a-f-]+)(?:\?.*)?$/i);

  if (!match) {
    throw new Error(`Could not extract UUID from URL: ${url}`);
  }

  return match[1];
}

async function pickRequestedExecutionDate() {
  return new Date().toLocaleDateString("ru-RU");
}

async function moveDealStatus(
  page: Page,
  targetStatus: string,
  expectedLabel: string,
) {
  await page.getByTestId("deal-change-status-button").click();
  await page.getByTestId(`deal-change-status-option-${targetStatus}`).click();
  await expect(page.getByTestId("deal-status-badge")).toHaveText(
    expectedLabel,
    {
      timeout: 20_000,
    },
  );
}

async function readDealLegState(page: Page, dealId: string, idx: number) {
  const response = await page.request.get(
    `/v1/deals/${encodeURIComponent(dealId)}/crm-workbench`,
  );

  if (!response.ok()) {
    throw new Error(`Could not read CRM workbench: ${response.status()}`);
  }

  const workbench = (await response.json()) as {
    workflow: {
      executionPlan: Array<{
        idx: number;
        state: string;
      }>;
    };
  };
  const leg = workbench.workflow.executionPlan.find(
    (candidate) => candidate.idx === idx,
  );

  if (!leg) {
    throw new Error(`Could not find CRM execution leg ${idx}`);
  }

  return DEAL_LEG_STATE_LABELS[leg.state] ?? leg.state;
}

async function waitForDealLegState(
  page: Page,
  dealId: string,
  idx: number,
  expectedLabel: string,
) {
  await expect
    .poll(
      async () => {
        await page.reload();
        await openCrmExecutionTab(page);
        return readDealLegState(page, dealId, idx);
      },
      {
        timeout: 30_000,
      },
    )
    .toBe(expectedLabel);
}

async function openCrmExecutionTab(page: Page) {
  await page.getByTestId("deal-tab-execution").click();
  await expect(page.getByText("Исполнение и готовность")).toBeVisible({
    timeout: 20_000,
  });
}

async function waitForLegReadyOrBeyond(page: Page, dealId: string, idx: number) {
  // Leg state is now a projection over instruction state + doc posting. We
  // can't *drive* the leg forward manually — it advances when the upstream
  // instructions settle and the required doc lands. Just poll until we see
  // something other than a not-yet-started state.
  await expect
    .poll(
      async () => {
        await page.reload();
        await openCrmExecutionTab(page);
        return readDealLegState(page, dealId, idx);
      },
      { timeout: 60_000 },
    )
    .toMatch(/Подготовлен|В работе|Завершен/);
}

async function waitForLegDone(page: Page, dealId: string, idx: number) {
  await expect
    .poll(
      async () => {
        await page.reload();
        await openCrmExecutionTab(page);
        return readDealLegState(page, dealId, idx);
      },
      { timeout: 60_000 },
    )
    .toBe(DEAL_LEG_DONE_LABEL);
}

async function createAndPostFinanceDocument(
  page: Page,
  input: {
    actionTestId?: string;
    dealId: string;
    docType: "acceptance" | "application" | "exchange" | "invoice";
    invoicePurpose?: "agency_fee" | "combined" | "principal";
    invoiceDocumentId?: string;
    returnTab: "documents" | "execution";
    fillForm?: (page: Page) => Promise<void>;
  },
) {
  if (input.actionTestId) {
    await expect(page.getByTestId(input.actionTestId)).toBeVisible({
      timeout: 20_000,
    });
    await page.getByTestId(input.actionTestId).click();
  } else {
    const query = new URLSearchParams({
      dealId: input.dealId,
      returnTo: `/treasury/deals/${input.dealId}`,
    });

    if (input.invoicePurpose) {
      query.set("invoicePurpose", input.invoicePurpose);
    }

    await page.goto(
      `${PAYMENT_DEAL_FINANCE_BASE_URL}/documents/create/${input.docType}?${query}`,
    );
  }

  await page.waitForURL(
    new RegExp(`/documents/create/${input.docType}(?:\\?.*)?$`, "i"),
  );

  if (input.fillForm) {
    await input.fillForm(page);
  }

  if (input.invoiceDocumentId) {
    const invoiceDocumentField = page.locator(
      "#document-field-invoiceDocumentId",
    );

    if ((await invoiceDocumentField.count()) > 0) {
      const currentValue = (await invoiceDocumentField.inputValue()).trim();

      if (currentValue.length === 0) {
        await invoiceDocumentField.fill(input.invoiceDocumentId);
      }
    }
  }

  await expect(page.getByTestId("finance-document-form-submit")).toBeEnabled({
    timeout: 20_000,
  });
  await page.getByTestId("finance-document-form-submit").click();

  const detailsUrlPattern = new RegExp(
    `/documents/[^/]+/${input.docType}/[0-9a-f-]+(?:\\?.*)?$`,
    "i",
  );
  const returnUrlPattern = buildFinanceDealTabUrlPattern(
    input.dealId,
    input.returnTab,
  );

  await page.waitForURL(
    (url) =>
      detailsUrlPattern.test(url.toString()) ||
      returnUrlPattern.test(url.toString()),
    {
      timeout: 20_000,
    },
  );

  if (returnUrlPattern.test(page.url())) {
    if (!input.actionTestId) {
      throw new Error(
        `Document ${input.docType} creation returned to the deal before opening document details`,
      );
    }

    await expect(page.getByTestId(input.actionTestId)).toBeVisible({
      timeout: 20_000,
    });
    await page.getByTestId(input.actionTestId).click();
    await page.waitForURL(detailsUrlPattern, {
      timeout: 20_000,
    });
  }

  const documentId = extractTrailingUuid(page.url());
  await progressFinanceDocument(page);

  return documentId;
}

async function waitForFinanceDocumentHeader(
  page: Page,
  dealId: string,
  expectedText: string | RegExp,
) {
  await expect
    .poll(
      async () => {
        await page.goto(buildFinanceDealUrl(dealId, "documents"));
        return (
          (await page
            .getByTestId("finance-deal-header-documents")
            .textContent()) ?? ""
        ).trim();
      },
      {
        timeout: 90_000,
      },
    )
    .toMatch(expectedText);
}

async function progressFinanceDocument(page: Page) {
  const submitButton = page.getByTestId("document-action-submit");
  if ((await submitButton.count()) > 0) {
    await submitButton.click();
    await expect(
      page.getByTestId("finance-document-status-submission"),
    ).toContainText("Отправлен", {
      timeout: 20_000,
    });
  }

  const approveButton = page.getByTestId("document-action-approve");
  if ((await approveButton.count()) > 0) {
    await approveButton.click();
    await expect(
      page.getByTestId("finance-document-status-approval"),
    ).toContainText(/Согласован|Не требуется/, {
      timeout: 20_000,
    });
  }

  const postButton = page.getByTestId("document-action-post");
  if ((await postButton.count()) > 0) {
    await postButton.click();
    await Promise.race([
      page.waitForURL(/\/treasury\/deals\/[0-9a-f-]+(?:\?.*)?$/i, {
        timeout: 20_000,
      }),
      expect(
        page.getByTestId("finance-document-status-posting"),
      ).toContainText(/Проведен|Не требуется/, {
        timeout: 20_000,
      }),
    ]);
  }

  if (/\/treasury\/deals\/[0-9a-f-]+(?:\?.*)?$/i.test(page.url())) {
    return;
  }

  await expect
    .poll(
      async () => {
        await page.reload();
        return (
          (await page
            .getByTestId("finance-document-status-posting")
            .textContent()) ?? ""
        ).trim();
      },
      {
        timeout: 90_000,
      },
    )
    .toMatch(/Проведен|Не требуется/);
}

async function waitForFinanceReconciliationNotRequired(
  page: Page,
  dealId: string,
) {
  await page.goto(buildFinanceDealUrl(dealId, "execution"));

  await expect
    .poll(
      async () => {
        await page.goto(buildFinanceDealUrl(dealId, "execution"));

        const rerunButton = page.getByTestId("finance-deal-run-reconciliation");

        return {
          canRun:
            (await rerunButton.count()) > 0
              ? await rerunButton.isEnabled()
              : false,
          state: (
            (await page
              .getByTestId("finance-deal-reconciliation-state")
              .textContent()) ?? ""
          ).trim(),
        };
      },
      {
        timeout: 90_000,
      },
    )
    .toMatchObject({
      canRun: false,
      state: "Не требуется",
    });
}

async function readFinanceLegState(page: Page, idx: number) {
  await expect(page.getByTestId(`finance-deal-leg-state-${idx}`)).toBeVisible({
    timeout: 20_000,
  });

  return (
    (await page.getByTestId(`finance-deal-leg-state-${idx}`).textContent()) ??
    ""
  ).trim();
}

async function selectFinanceLeg(page: Page, dealId: string, idx: number) {
  await page.goto(buildFinanceDealUrl(dealId, "execution"));
  await expect(page.getByTestId(`finance-deal-leg-${idx}`)).toBeVisible({
    timeout: 20_000,
  });
  await page.getByTestId(`finance-deal-leg-${idx}`).click();
}

async function clickVisibleButtonByName(page: Page, name: string) {
  const button = page.getByRole("button", { name }).first();

  if ((await button.count()) === 0 || !(await button.isVisible())) {
    return false;
  }

  await button.click();
  return true;
}

async function clickButtonByName(page: Page, name: string) {
  const button = page.getByRole("button", { name }).first();
  await expect(button).toBeVisible({ timeout: 20_000 });
  await button.click();
}

async function confirmSelectedFinanceStep(
  page: Page,
  input: { evidenceFile?: string },
) {
  const stepCard = page.locator("[data-testid^='finance-step-card-']").first();
  const usesConfirmationDialog =
    (await stepCard.count()) > 0 && (await stepCard.isVisible());

  await clickButtonByName(page, "Подтвердить исполнение");

  if (!usesConfirmationDialog) {
    return;
  }

  const dialogSubmit = page
    .locator("[data-testid^='finance-step-confirm-submit-']")
    .first();

  await expect(dialogSubmit).toBeVisible({ timeout: 20_000 });

  const evidenceFile = page
    .locator("[data-testid^='finance-step-confirm-file-']")
    .first();

  if (input.evidenceFile && (await evidenceFile.count()) > 0) {
    await evidenceFile.setInputFiles(input.evidenceFile);
  }

  await expect(dialogSubmit).toBeEnabled({ timeout: 20_000 });
  await dialogSubmit.click();
}

async function completeFinanceLeg(
  page: Page,
  input: {
    dealId: string;
    evidenceFile?: string;
    idx: number;
  },
) {
  await selectFinanceLeg(page, input.dealId, input.idx);

  await clickVisibleButtonByName(page, "Направить в исполнение");

  await expect
    .poll(
      async () => {
        await selectFinanceLeg(page, input.dealId, input.idx);
        return readFinanceLegState(page, input.idx);
      },
      {
        timeout: 90_000,
      },
    )
    .toMatch(/В работе|В обработке|Завершен/);

  const stateBeforeConfirm = await readFinanceLegState(page, input.idx);

  if (stateBeforeConfirm !== DEAL_LEG_DONE_LABEL) {
    await confirmSelectedFinanceStep(page, {
      evidenceFile: input.evidenceFile,
    });
  }

  await expect
    .poll(
      async () => {
        await selectFinanceLeg(page, input.dealId, input.idx);
        return readFinanceLegState(page, input.idx);
      },
      {
        timeout: 90_000,
      },
    )
    .toBe(DEAL_LEG_DONE_LABEL);
}

test("runs the payment deal end-to-end through CRM and finance", async ({
  browser,
  page,
}) => {
  test.slow();
  const financeContext = await browser.newContext({
    storageState: PAYMENT_DEAL_FINANCE_AUTH_FILE,
  });
  const financePage = await financeContext.newPage();
  let dealId = "";

  try {
    await test.step("open the CRM deal list", async () => {
      await page.goto("/deals");
      await expect(page.getByTestId("crm-new-deal-button")).toBeVisible();
    });

    await test.step("choose the customer context", async () => {
      await page.getByTestId("crm-new-deal-button").click();

      await page.getByTestId("deal-customer-select").click();
      await page
        .getByTestId("deal-customer-search")
        .fill(paymentDealInput.customerName);
      await pickCommandItem(page, paymentDealInput.customerName);

      await expect(page.getByTestId("deal-customer-select")).toContainText(
        paymentDealInput.customerName,
      );
      await page.getByTestId("deal-dialog-next").click();

      await page.getByTestId("deal-applicant-select").click();
      await pickSelectItem(page, paymentDealInput.applicantName);

      await page.getByTestId("deal-agreement-select").click();
      await pickSelectItem(page, paymentDealInput.agreementNumber);

      await page.getByTestId("deal-dialog-next").click();
    });

    await test.step("choose the payment deal type", async () => {
      await page.getByTestId("deal-type-payment").click();
      await page.getByTestId("deal-dialog-next").click();
    });

    await test.step("fill the payment intake", async () => {
      await page.locator("#deal-requested-execution-date").click();
      await page
        .locator(
          `[data-slot='calendar'] button[data-day='${await pickRequestedExecutionDate()}']`,
        )
        .click();

      await page
        .getByTestId("deal-primary-amount-input")
        .fill(paymentDealInput.primaryAmount);

      await page.getByTestId("deal-target-currency-select").click();
      await pickListboxOption(page, paymentDealInput.targetCurrencyLabel);

      await page.getByTestId("deal-source-currency-select").click();
      await pickListboxOption(page, paymentDealInput.sourceCurrencyLabel);

      await page
        .getByTestId("deal-purpose-input")
        .fill(paymentDealInput.purpose);
      await page
        .getByTestId("deal-invoice-number-input")
        .fill(paymentDealInput.invoiceNumber);
      await page
        .getByTestId("deal-contract-number-input")
        .fill(paymentDealInput.contractNumber);

      await page
        .getByTestId("deal-beneficiary-display-name-input")
        .fill(paymentDealInput.beneficiary.displayName);
      await page
        .getByTestId("deal-beneficiary-legal-name-input")
        .fill(paymentDealInput.beneficiary.legalName);
      await page
        .getByTestId("deal-beneficiary-inn-input")
        .fill(paymentDealInput.beneficiary.inn);
      await page.getByTestId("deal-beneficiary-country-input").click();
      await pickCommandItem(page, paymentDealInput.beneficiaryCountryLabel);
      await page
        .getByTestId("deal-beneficiary-bank-name-input")
        .fill(paymentDealInput.beneficiary.bankName);
      await page
        .getByTestId("deal-beneficiary-bank-country-input")
        .fill(paymentDealInput.beneficiary.bankCountry);
      await page
        .getByTestId("deal-beneficiary-account-input")
        .fill(paymentDealInput.beneficiary.account);
      await page
        .getByTestId("deal-beneficiary-iban-input")
        .fill(paymentDealInput.beneficiary.iban);
      await page
        .getByTestId("deal-beneficiary-bic-input")
        .fill(paymentDealInput.beneficiary.bic);
      await page
        .getByTestId("deal-beneficiary-swift-input")
        .fill(paymentDealInput.beneficiary.swift);
      await page
        .getByTestId("deal-beneficiary-name-input")
        .fill(paymentDealInput.beneficiary.beneficiaryName);
      await page
        .getByTestId("deal-beneficiary-label-input")
        .fill(paymentDealInput.beneficiary.label);
    });

    await test.step("save the draft and capture the deal id", async () => {
      await page.getByTestId("deal-create-draft").click();
      await page.waitForURL(/\/deals\/[0-9a-f-]+$/);

      dealId = extractTrailingUuid(page.url());

      await page.getByTestId("deal-tab-pricing").click();
      await expect(
        page.getByText('Нельзя запросить котировку для статуса "Черновик".'),
      ).toBeVisible();

      await page.getByTestId("deal-tab-documents").click();
      await expect(page.getByText("Требуемые документы")).toBeVisible();
    });

    await test.step("prepare CRM pricing and document-ready state", async () => {
      await moveDealStatus(page, "submitted", "Отправлена");

      await page.getByTestId("deal-tab-pricing").click();
      const commitPricingButton = page.getByTestId(
        "deal-commit-pricing-button-top",
      );

      await expect(commitPricingButton).toBeEnabled({ timeout: 20_000 });
      await commitPricingButton.click();
      await expect(commitPricingButton).toContainText("Зафиксировано", {
        timeout: 20_000,
      });
      await expect(page.getByText("53 251.25 AED").first()).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByText("14 500.00 $")).toBeVisible({
        timeout: 20_000,
      });

      await moveDealStatus(
        page,
        "preparing_documents",
        "Подготовка документов",
      );
    });

    await test.step("create and post the opening documents in finance", async () => {
      await createAndPostFinanceDocument(financePage, {
        dealId,
        docType: "application",
        returnTab: "documents",
      });
      await createAndPostFinanceDocument(financePage, {
        dealId,
        docType: "invoice",
        returnTab: "documents",
      });

      await financePage.goto(buildFinanceDealUrl(dealId, "documents"));
      await waitForFinanceDocumentHeader(financePage, dealId, /2 \/ 3/);
    });

    await test.step("advance the CRM deal to awaiting funds", async () => {
      await page.reload();
      await moveDealStatus(page, "awaiting_funds", "Ожидание средств");
    });

    await test.step("execute the collection and conversion finance steps", async () => {
      await completeFinanceLeg(financePage, {
        dealId,
        idx: 1,
      });
      await completeFinanceLeg(financePage, {
        dealId,
        idx: 2,
      });
    });

    await test.step("create and post the exchange document for the FX leg", async () => {
      await createAndPostFinanceDocument(financePage, {
        dealId,
        docType: "exchange",
        fillForm: async (documentPage) => {
          const executionRefField = documentPage.locator(
            "#document-field-executionRef",
          );
          if ((await executionRefField.count()) > 0) {
            const currentValue = (await executionRefField.inputValue()).trim();

            if (currentValue.length === 0) {
              await executionRefField.fill(`conversion-${dealId}`);
            }
          }
        },
        returnTab: "execution",
      });
    });

    await test.step("wait for CRM execution legs to auto-advance from settled instructions + posted docs", async () => {
      await page.reload();
      await openCrmExecutionTab(page);

      // Legs 1 (collect) + 2 (convert) should auto-advance to done once the
      // invoice is posted + convert instruction settles + exchange doc lands.
      await waitForLegDone(page, dealId, 1);
      await waitForDealLegState(page, dealId, 2, DEAL_LEG_DONE_LABEL);

      // Leg 3 (payout) should be at least ready after the convert settles;
      // we then move the deal to awaiting_payment which lets the payout
      // instruction progress and eventually settle.
      await waitForLegReadyOrBeyond(page, dealId, 3);
      await moveDealStatus(page, "awaiting_payment", "Ожидание оплаты");

      await completeFinanceLeg(financePage, {
        dealId,
        evidenceFile: PAYMENT_DEAL_INVOICE_FILE,
        idx: 3,
      });

      await openCrmExecutionTab(page);
      await waitForLegDone(page, dealId, 3);
      await moveDealStatus(page, "closing_documents", "Закрывающие документы");
    });

    await test.step("verify reconciliation is not required for finance close", async () => {
      await waitForFinanceReconciliationNotRequired(financePage, dealId);
    });

    await test.step("create and post the closing acceptance document", async () => {
      await createAndPostFinanceDocument(financePage, {
        dealId,
        docType: "acceptance",
        returnTab: "documents",
      });

      await financePage.goto(buildFinanceDealUrl(dealId, "documents"));
      await waitForFinanceDocumentHeader(financePage, dealId, /Готово/);
    });

    await test.step("close the deal in finance and verify CRM is done", async () => {
      await financePage.goto(buildFinanceDealUrl(dealId, "execution"));
      await expect(financePage.getByTestId("finance-deal-close")).toBeVisible({
        timeout: 20_000,
      });
      await financePage.getByTestId("finance-deal-close").click();
      await expect(
        financePage.getByTestId("finance-deal-status-badge"),
      ).toHaveText("Завершена", {
        timeout: 20_000,
      });

      await page.reload();
      await expect(page.getByTestId("deal-status-badge")).toHaveText(
        "Завершена",
        {
          timeout: 20_000,
        },
      );
    });
  } finally {
    await financeContext.close();
  }
});
