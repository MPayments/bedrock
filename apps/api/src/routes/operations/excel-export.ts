import ExcelJS from "exceljs";
import { listCompatibilityDeals } from "./deals-compat";
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

import type { AppContext } from "../../context";

const HEADER_STYLE: Partial<ExcelJS.Style> = {
  font: { bold: true, name: "Calibri", size: 11 },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } },
};

function applyDefaults(ws: ExcelJS.Worksheet) {
  ws.columns.forEach((col) => { col.width = 20; });
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => { cell.style = HEADER_STYLE; });
}

// ---- Clients export ----

export async function exportClientsXlsx(ctx: AppContext): Promise<Buffer> {
  const result = await ctx.operationsModule.clients.queries.list({
    limit: 50000,
    offset: 0,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Клиенты");

  ws.columns = [
    { header: "ID", key: "id" },
    { header: "Организация", key: "orgName" },
    { header: "Тип", key: "orgType" },
    { header: "Директор", key: "directorName" },
    { header: "Должность", key: "position" },
    { header: "ИНН", key: "inn" },
    { header: "КПП", key: "kpp" },
    { header: "ОГРН", key: "ogrn" },
    { header: "Адрес", key: "address" },
    { header: "Email", key: "email" },
    { header: "Телефон", key: "phone" },
    { header: "Банк", key: "bankName" },
    { header: "Р/с", key: "account" },
    { header: "БИК", key: "bic" },
    { header: "К/с", key: "corrAccount" },
    { header: "Создан", key: "createdAt" },
  ];

  for (const client of result.data) {
    ws.addRow(client);
  }

  applyDefaults(ws);
  return await wb.xlsx.writeBuffer() as unknown as Buffer;
}

// ---- Deals export ----

export async function exportDealsXlsx(_ctx: AppContext, query: Record<string, unknown>): Promise<Buffer> {
  const result = await listCompatibilityDeals({
    limit: 50000,
    offset: 0,
    sortBy: "createdAt",
    sortOrder: "desc",
    ...(query as any),
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Сделки");

  ws.columns = [
    { header: "№", key: "id" },
    { header: "Дата", key: "createdAt" },
    { header: "Клиент", key: "clientName" },
    { header: "Сумма", key: "amount" },
    { header: "Валюта", key: "currencyCode" },
    { header: "Статус", key: "status" },
    { header: "Агент", key: "agentName" },
    { header: "Комментарий", key: "comment" },
    { header: "Курс", key: "rate" },
    { header: "Комиссия", key: "feePercentage" },
  ];

  for (const deal of result.data) {
    ws.addRow({
      id: deal.id,
      createdAt: deal.createdAt,
      clientName: deal.client,
      amount: deal.amount,
      currencyCode: deal.currency,
      status: deal.status,
      agentName: deal.agentName,
      comment: deal.comment ?? "",
      rate: "",
      feePercentage: deal.feePercentage,
    });
  }

  applyDefaults(ws);

  const totalRow = ws.addRow({ id: "", createdAt: "ИТОГО", clientName: "" });
  totalRow.font = { bold: true };

  return await wb.xlsx.writeBuffer() as unknown as Buffer;
}

export function xlsxFilename(prefix: string): string {
  return `${prefix}-${formatDate(new Date())}.xlsx`;
}
