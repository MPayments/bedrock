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
const FINANCE_INSTRUCTION_SETTLED_LABEL = "Исполнена";

function buildFinanceDealUrl(
  dealId: string,
  tab: "documents" | "execution" = "execution",
) {
  const query = tab === "execution" ? "" : `?tab=${tab}`;
  return `${PAYMENT_DEAL_FINANCE_BASE_URL}/treasury/deals/${dealId}${query}`;
}

function buildFinanceDealTabUrlPattern(
  dealId: string,
  tab: "documents" | "execution",
) {
  const query =
    tab === "execution" ? "(?:\\?.*)?$" : "\\?tab=documents(?:&.*)?$";
  return new RegExp(`/treasury/deals/${dealId}${query}`, "i");
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

async function readDealLegState(page: Page, idx: number) {
  await expect(page.getByTestId(`deal-leg-state-badge-${idx}`)).toBeVisible({
    timeout: 20_000,
  });
  const text = await page
    .getByTestId(`deal-leg-state-badge-${idx}`)
    .textContent();
  return text?.trim() ?? "";
}

async function waitForDealLegState(
  page: Page,
  idx: number,
  expectedLabel: string,
) {
  await expect
    .poll(
      async () => {
        await page.reload();
        await openCrmExecutionTab(page, idx);
        return readDealLegState(page, idx);
      },
      {
        timeout: 30_000,
      },
    )
    .toBe(expectedLabel);
}

async function openCrmExecutionTab(page: Page, idx = 1) {
  await page.getByTestId("deal-tab-execution").click();
  await expect(page.getByTestId(`deal-leg-state-badge-${idx}`)).toBeVisible({
    timeout: 20_000,
  });
}

async function waitForLegReadyOrBeyond(page: Page, idx: number) {
  // Leg state is now a projection over instruction state + doc posting. We
  // can't *drive* the leg forward manually — it advances when the upstream
  // instructions settle and the required doc lands. Just poll until we see
  // something other than a not-yet-started state.
  await expect
    .poll(
      async () => {
        await page.reload();
        await openCrmExecutionTab(page, idx);
        return readDealLegState(page, idx);
      },
      { timeout: 60_000 },
    )
    .toMatch(/Готов|В работе|Завершен/);
}

async function waitForLegDone(page: Page, idx: number) {
  await expect
    .poll(
      async () => {
        await page.reload();
        await openCrmExecutionTab(page, idx);
        return readDealLegState(page, idx);
      },
      { timeout: 60_000 },
    )
    .toBe(DEAL_LEG_DONE_LABEL);
}

async function createAndPostFinanceDocument(
  page: Page,
  input: {
    actionTestId: string;
    dealId: string;
    docType: "acceptance" | "exchange" | "invoice";
    invoiceDocumentId?: string;
    returnTab: "documents" | "execution";
    fillForm?: (page: Page) => Promise<void>;
  },
) {
  await expect(page.getByTestId(input.actionTestId)).toBeVisible({
    timeout: 20_000,
  });
  await page.getByTestId(input.actionTestId).click();
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

async function progressFinanceDocument(page: Page) {
  const submitButton = page.getByTestId("finance-document-action-submit");
  if ((await submitButton.count()) > 0) {
    await submitButton.click();
    await expect(
      page.getByTestId("finance-document-status-submission"),
    ).toContainText("Отправлен", {
      timeout: 20_000,
    });
  }

  const approveButton = page.getByTestId("finance-document-action-approve");
  if ((await approveButton.count()) > 0) {
    await approveButton.click();
    await expect(
      page.getByTestId("finance-document-status-approval"),
    ).toContainText(/Согласован|Не требуется/, {
      timeout: 20_000,
    });
  }

  const postButton = page.getByTestId("finance-document-action-post");
  if ((await postButton.count()) > 0) {
    await postButton.click();
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

async function collectFinanceOperationUrls(page: Page) {
  return page
    .locator(
      "[data-testid^='finance-deal-operation-open-'], a[href*='/treasury/operations/']",
    )
    .evaluateAll((elements) => {
      const hrefs = elements
        .map((element) => element.getAttribute("href"))
        .filter((value): value is string =>
          Boolean(value && value.includes("/treasury/operations/")),
        );

      return Array.from(new Set(hrefs));
    });
}

async function readFinanceOperationUrlsViaApi(page: Page, dealId: string) {
  const response = await page.request.get(
    `${PAYMENT_DEAL_FINANCE_BASE_URL}/v1/deals/${encodeURIComponent(dealId)}/finance-workspace`,
    {
      headers: {
        "x-bedrock-app-audience": "finance",
      },
    },
  );

  if (!response.ok()) {
    return [];
  }

  const payload = (await response.json()) as {
    relatedResources?: {
      operations?: Array<{
        operationHref?: string;
      }>;
    };
  };

  return (payload.relatedResources?.operations ?? [])
    .map((operation) => operation.operationHref ?? "")
    .filter((href) => href.includes("/treasury/operations/"));
}

async function waitForFinanceOperationUrls(page: Page, dealId: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await page.goto(buildFinanceDealUrl(dealId, "execution"));

    const urls = [
      ...(await collectFinanceOperationUrls(page)),
      ...(await readFinanceOperationUrlsViaApi(page, dealId)),
    ];

    if (urls.length > 0) {
      return Array.from(new Set(urls)).map((url) =>
        url.startsWith("http") ? url : `${PAYMENT_DEAL_FINANCE_BASE_URL}${url}`,
      );
    }

    await page.waitForTimeout(2_000);
  }

  throw new Error(
    "Finance operations did not appear after requesting execution",
  );
}

async function settleFinanceOperation(page: Page, url: string) {
  await page.goto(url);
  await expect(
    page.getByTestId("finance-operation-instruction-status"),
  ).toBeVisible({
    timeout: 20_000,
  });

  if (
    (
      await page
        .getByTestId("finance-operation-instruction-status")
        .textContent()
    )?.includes(FINANCE_INSTRUCTION_SETTLED_LABEL)
  ) {
    return;
  }

  const prepareButton = page.getByTestId("finance-operation-prepare");
  if ((await prepareButton.count()) > 0) {
    await prepareButton.click();
    await expect(
      page.getByTestId("finance-operation-instruction-status"),
    ).toContainText("Подготовлена", {
      timeout: 20_000,
    });
  }

  const submitButton = page.getByTestId("finance-operation-submit");
  if ((await submitButton.count()) > 0) {
    await submitButton.click();
    await expect(
      page.getByTestId("finance-operation-instruction-status"),
    ).toContainText("Отправлена", {
      timeout: 20_000,
    });
  }

  const settleButton = page.getByTestId("finance-operation-outcome-settled");
  if ((await settleButton.count()) > 0) {
    await settleButton.click();
  }

  await expect(
    page.getByTestId("finance-operation-instruction-status"),
  ).toContainText(FINANCE_INSTRUCTION_SETTLED_LABEL, {
    timeout: 20_000,
  });
}

async function readFinanceLegOperationUrl(page: Page, idx: number) {
  const leg = page.getByTestId(`finance-deal-leg-${idx}`);
  const href = await leg
    .locator("a[href*='/treasury/operations/']")
    .first()
    .getAttribute("href");

  if (!href) {
    throw new Error(`Could not find an operation link for finance leg ${idx}`);
  }

  return href.startsWith("http")
    ? href
    : `${PAYMENT_DEAL_FINANCE_BASE_URL}${href}`;
}

async function runAndWaitForFinanceReconciliation(page: Page, dealId: string) {
  await page.goto(buildFinanceDealUrl(dealId, "execution"));

  await expect
    .poll(
      async () => {
        await page.goto(buildFinanceDealUrl(dealId, "execution"));

        const rerunButton = page.getByTestId("finance-deal-run-reconciliation");
        if (
          (await rerunButton.count()) > 0 &&
          (await rerunButton.isEnabled())
        ) {
          await rerunButton.click();
          await page.waitForLoadState("networkidle");
        }

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
      state: "Сверка завершена",
    });
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
  let openingInvoiceDocumentId = "";

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
        .getByTestId("deal-source-amount-input")
        .fill(paymentDealInput.sourceAmount);
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
      await expect(page.getByTestId("deal-request-quote-button")).toBeVisible();

      await page.getByTestId("deal-tab-documents").click();
      await expect(
        page.getByTestId("deal-upload-attachment-button"),
      ).toBeVisible();
    });

    await test.step("upload the invoice attachment", async () => {
      await page.getByTestId("deal-upload-attachment-button").click();

      const uploadDialog = page.getByRole("dialog", {
        name: "Загрузить вложение",
      });

      await expect(uploadDialog).toBeVisible();
      await page
        .getByTestId("deal-attachment-file-input")
        .setInputFiles(PAYMENT_DEAL_INVOICE_FILE);
      await page
        .getByTestId("deal-attachment-description-input")
        .fill(paymentDealInput.invoiceUploadDescription);
      await page.getByTestId("deal-attachment-purpose-select").click();
      await pickListboxOption(page, "Инвойс");
      await page.getByTestId("deal-attachment-submit").click();

      await expect(uploadDialog).toBeHidden({ timeout: 15_000 });
      await expect(page.getByText("invoice.pdf", { exact: true })).toBeVisible({
        timeout: 15_000,
      });
    });

    await test.step("prepare CRM pricing and document-ready state", async () => {
      await moveDealStatus(page, "submitted", "Отправлена");

      await page.getByTestId("deal-tab-pricing").click();
      await expect(page.getByTestId("deal-request-quote-button")).toBeEnabled({
        timeout: 20_000,
      });
      await page.getByTestId("deal-request-quote-button").click();

      const quoteDialog = page.getByRole("dialog", {
        name: "Запросить котировку",
      });

      await expect(quoteDialog).toBeVisible();
      await page.getByTestId("deal-create-quote-confirm").click();
      await expect(quoteDialog).toBeHidden({ timeout: 20_000 });

      const acceptQuoteButton = page
        .locator("[data-testid^='deal-accept-quote-button-']")
        .first();

      await expect(acceptQuoteButton).toBeVisible({ timeout: 20_000 });
      await acceptQuoteButton.click();

      await expect(page.getByText("Принята", { exact: true })).toBeVisible({
        timeout: 20_000,
      });

      await page.getByTestId("deal-create-calculation-button").click();

      const createCalculationDialog = page.getByRole("dialog", {
        name: "Создать расчет",
      });

      await expect(createCalculationDialog).toBeVisible();
      await page.getByTestId("deal-create-calculation-confirm").click();
      await expect(createCalculationDialog).toBeHidden({ timeout: 20_000 });
      await expect(page.getByText("Итого к списанию")).toBeVisible({
        timeout: 20_000,
      });

      await moveDealStatus(
        page,
        "preparing_documents",
        "Подготовка документов",
      );
    });

    await test.step("create and post the opening invoice in finance", async () => {
      await financePage.goto(buildFinanceDealUrl(dealId, "documents"));
      await expect(
        financePage.getByTestId(
          "finance-deal-formal-document-action-opening-invoice",
        ),
      ).toBeVisible({
        timeout: 20_000,
      });

      openingInvoiceDocumentId = await createAndPostFinanceDocument(
        financePage,
        {
          actionTestId: "finance-deal-formal-document-action-opening-invoice",
          dealId,
          docType: "invoice",
          returnTab: "documents",
        },
      );

      await financePage.goto(buildFinanceDealUrl(dealId, "documents"));
      await expect(
        financePage.getByTestId(
          "finance-deal-formal-document-state-opening-invoice",
        ),
      ).toHaveText("Готов", {
        timeout: 20_000,
      });
    });

    await test.step("advance the CRM deal to awaiting funds", async () => {
      await page.reload();
      await moveDealStatus(page, "awaiting_funds", "Ожидание средств");
    });

    await test.step("request finance execution and settle treasury operations", async () => {
      await financePage.goto(buildFinanceDealUrl(dealId, "execution"));
      await expect(
        financePage.getByTestId("finance-deal-request-execution"),
      ).toBeVisible({
        timeout: 20_000,
      });
      await financePage.getByTestId("finance-deal-request-execution").click();

      const operationUrls = await waitForFinanceOperationUrls(
        financePage,
        dealId,
      );

      for (const operationUrl of operationUrls) {
        await settleFinanceOperation(financePage, operationUrl);
      }
    });

    await test.step("reconcile the settled treasury operations from finance", async () => {
      await runAndWaitForFinanceReconciliation(financePage, dealId);
    });

    await test.step("create and post the exchange document for the FX leg", async () => {
      await financePage.goto(buildFinanceDealUrl(dealId, "execution"));
      const convertOperationUrl = await readFinanceLegOperationUrl(
        financePage,
        2,
      );
      const convertOperationId = extractTrailingUuid(convertOperationUrl);

      await createAndPostFinanceDocument(financePage, {
        actionTestId: "finance-deal-exchange-document-action-2",
        dealId,
        docType: "exchange",
        fillForm: async (documentPage) => {
          const executionRefField = documentPage.locator(
            "#document-field-executionRef",
          );
          if ((await executionRefField.count()) > 0) {
            const currentValue = (await executionRefField.inputValue()).trim();

            if (currentValue.length === 0) {
              await executionRefField.fill(convertOperationId);
            }
          }
        },
        invoiceDocumentId: openingInvoiceDocumentId,
        returnTab: "execution",
      });
    });

    await test.step("wait for CRM execution legs to auto-advance from settled instructions + posted docs", async () => {
      await page.reload();
      await openCrmExecutionTab(page);

      // Legs 1 (collect) + 2 (convert) should auto-advance to done once the
      // invoice is posted + convert instruction settles + exchange doc lands.
      await waitForLegDone(page, 1);
      await waitForDealLegState(page, 2, DEAL_LEG_DONE_LABEL);

      // Leg 3 (payout) should be at least ready after the convert settles;
      // we then move the deal to awaiting_payment which lets the payout
      // instruction progress and eventually settle.
      await waitForLegReadyOrBeyond(page, 3);
      await moveDealStatus(page, "awaiting_payment", "Ожидание оплаты");

      await openCrmExecutionTab(page, 3);
      await waitForLegDone(page, 3);
      await moveDealStatus(page, "closing_documents", "Закрывающие документы");
    });

    await test.step("create and post the closing acceptance document", async () => {
      await financePage.goto(buildFinanceDealUrl(dealId, "documents"));
      await expect(
        financePage.getByTestId(
          "finance-deal-formal-document-action-closing-acceptance",
        ),
      ).toBeVisible({
        timeout: 20_000,
      });

      await createAndPostFinanceDocument(financePage, {
        actionTestId: "finance-deal-formal-document-action-closing-acceptance",
        dealId,
        docType: "acceptance",
        invoiceDocumentId: openingInvoiceDocumentId,
        returnTab: "documents",
      });

      await financePage.goto(buildFinanceDealUrl(dealId, "documents"));
      await expect(
        financePage.getByTestId(
          "finance-deal-formal-document-state-closing-acceptance",
        ),
      ).toHaveText("Готов", {
        timeout: 20_000,
      });
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
