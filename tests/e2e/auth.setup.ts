import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { expect, test } from "@playwright/test";

import {
  PAYMENT_DEAL_CRM_AUTH_FILE,
  PAYMENT_DEAL_FINANCE_AUTH_FILE,
  PAYMENT_DEAL_FINANCE_BASE_URL,
  paymentDealFinanceUser,
  paymentDealOperator,
} from "./deal-payment.fixture";

test("authenticate operator and finance user for payment deal flow", async ({
  browser,
  page,
}) => {
  mkdirSync(dirname(PAYMENT_DEAL_CRM_AUTH_FILE), { recursive: true });
  mkdirSync(dirname(PAYMENT_DEAL_FINANCE_AUTH_FILE), { recursive: true });

  await page.goto("/login");
  await page.getByTestId("login-email").fill(paymentDealOperator.email);
  await page.getByTestId("login-password").fill(paymentDealOperator.password);
  await page.getByTestId("login-submit").click();

  await page.waitForURL(/\/(?:$|deals)/);
  await page.goto("/deals");
  await expect(page.getByTestId("crm-new-deal-button")).toBeVisible();

  await page.context().storageState({ path: PAYMENT_DEAL_CRM_AUTH_FILE });

  const financeContext = await browser.newContext();
  const financePage = await financeContext.newPage();

  await financePage.goto(`${PAYMENT_DEAL_FINANCE_BASE_URL}/login`);
  await financePage
    .getByTestId("finance-login-email")
    .fill(paymentDealFinanceUser.email);
  await financePage
    .getByTestId("finance-login-password")
    .fill(paymentDealFinanceUser.password);
  await financePage.getByTestId("finance-login-submit").click();

  await expect
    .poll(async () => {
      const cookies = await financeContext.cookies(
        PAYMENT_DEAL_FINANCE_BASE_URL,
      );
      return cookies.some(
        (cookie) => cookie.name === "bedrock-finance.session_token",
      );
    })
    .toBe(true);
  await financePage.goto(
    `${PAYMENT_DEAL_FINANCE_BASE_URL}/documents/commercial`,
  );
  await expect(financePage).toHaveURL(/\/documents\/commercial(?:\?.*)?$/);
  await financeContext.storageState({ path: PAYMENT_DEAL_FINANCE_AUTH_FILE });
  await financeContext.close();
});
