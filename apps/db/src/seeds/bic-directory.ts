import { readFile } from "node:fs/promises";

import AdmZip from "adm-zip";
import { eq } from "drizzle-orm";
import { XMLParser } from "fast-xml-parser";
import iconv from "iconv-lite";
import { v5 as uuidv5 } from "uuid";

import type { Database, Transaction } from "../client";
import { schema } from "../schema-registry";

const PROVIDER_NAMESPACE = "a3f0b2f4-2345-4c6e-bf5a-1d0b92e7d100";
const BRANCH_NAMESPACE = "a3f0b2f4-2345-4c6e-bf5a-1d0b92e7d200";

type DbLike = Database | Transaction;

type BicParticipantInfo = {
  NameP: string;
  CntrCd?: string;
  Rgn?: string;
  Ind?: string;
  Tnp?: string;
  Nnp?: string;
  Adr?: string;
  PrntBIC?: string;
  DateIn?: string;
  PtType?: string;
  Srvcs?: string;
  XchType?: string;
  UID?: string;
  ParticipantStatus?: string;
};

type BicAccount = {
  Account: string;
  RegulationAccountType: string;
  CK?: string;
  AccountCBRBIC?: string;
  DateIn?: string;
  AccountStatus?: string;
};

type BicEntry = {
  BIC: string;
  ParticipantInfo: BicParticipantInfo;
  Accounts?: BicAccount | BicAccount[];
};

export interface SeedBicDirectoryOptions {
  sourceUrl?: string;
  sourceFile?: string;
  timeoutMs?: number;
}

interface ResolvedOptions {
  sourceUrl: string;
  sourceFile: string;
  timeoutMs: number;
}

function resolveOptions(options: SeedBicDirectoryOptions): ResolvedOptions {
  return {
    sourceUrl:
      options.sourceUrl ??
      process.env.BIC_DIRECTORY_SOURCE_URL ??
      "https://cbr.ru/s/newbik",
    sourceFile:
      options.sourceFile ?? process.env.BIC_DIRECTORY_SOURCE_FILE ?? "",
    timeoutMs:
      options.timeoutMs ??
      Number(process.env.BIC_DIRECTORY_FETCH_TIMEOUT_MS ?? "60000"),
  };
}

function isZipBuffer(buffer: Buffer): boolean {
  if (buffer.length < 4) {
    return false;
  }
  return (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  );
}

function extractXmlFromZip(buffer: Buffer): Buffer {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const xmlEntry = entries.find((entry) =>
    entry.entryName.toLowerCase().endsWith(".xml"),
  );
  if (!xmlEntry) {
    const names = entries.map((entry) => entry.entryName).join(", ");
    throw new Error(
      `[seed:bic-directory] ZIP archive does not contain an .xml entry (found: ${names})`,
    );
  }
  return xmlEntry.getData();
}

async function resolveSourceBuffer(options: ResolvedOptions): Promise<Buffer> {
  if (options.sourceFile) {
    return readFile(options.sourceFile);
  }
  const response = await fetch(options.sourceUrl, {
    signal: AbortSignal.timeout(options.timeoutMs),
  });
  if (!response.ok) {
    throw new Error(
      `[seed:bic-directory] Failed to fetch ${options.sourceUrl}: HTTP ${response.status}`,
    );
  }
  return Buffer.from(await response.arrayBuffer());
}

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function nullIfEmpty(value: string | undefined | null): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = decodeXmlEntities(String(value)).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatCity(
  tnp: string | undefined | null,
  nnp: string | undefined | null,
): string | null {
  const n = nullIfEmpty(nnp);
  if (!n) {
    return null;
  }
  const t = nullIfEmpty(tnp);
  return t ? `${t} ${n}` : n;
}

function findCrsaAccount(entry: BicEntry): string | null {
  for (const account of toArray(entry.Accounts)) {
    if (
      account.RegulationAccountType === "CRSA" &&
      (account.AccountStatus === undefined || account.AccountStatus === "ACAC")
    ) {
      return nullIfEmpty(account.Account);
    }
  }
  return null;
}

async function prefetchExistingBics(db: DbLike): Promise<Map<string, string>> {
  const rows = await db
    .select({
      providerId: schema.requisiteProviderIdentifiers.providerId,
      normalizedValue: schema.requisiteProviderIdentifiers.normalizedValue,
    })
    .from(schema.requisiteProviderIdentifiers)
    .where(eq(schema.requisiteProviderIdentifiers.scheme, "bic"));
  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.normalizedValue, row.providerId);
  }
  return map;
}

function normalizeBic(bic: string): string {
  return bic.trim().toUpperCase();
}

async function insertRootProvider(
  db: DbLike,
  entry: BicEntry,
): Promise<string> {
  const providerId = uuidv5(entry.BIC, PROVIDER_NAMESPACE);
  const name = nullIfEmpty(entry.ParticipantInfo.NameP) ?? entry.BIC;
  const country = nullIfEmpty(entry.ParticipantInfo.CntrCd) ?? "RU";

  await db
    .insert(schema.requisiteProviders)
    .values({
      id: providerId,
      kind: "bank",
      legalName: name,
      displayName: name,
      country,
      archivedAt: null,
    })
    .onConflictDoUpdate({
      target: schema.requisiteProviders.id,
      set: {
        kind: "bank",
        legalName: name,
        displayName: name,
        country,
        archivedAt: null,
      },
    });

  return providerId;
}

async function replaceProviderIdentifiers(
  db: DbLike,
  providerId: string,
  identifiers: Array<{ scheme: string; value: string }>,
) {
  await db
    .delete(schema.requisiteProviderIdentifiers)
    .where(eq(schema.requisiteProviderIdentifiers.providerId, providerId));

  if (identifiers.length === 0) {
    return;
  }

  await db.insert(schema.requisiteProviderIdentifiers).values(
    identifiers.map((id) => ({
      providerId,
      scheme: id.scheme,
      value: id.value,
      normalizedValue: id.value.trim().toUpperCase(),
      isPrimary: true,
    })),
  );
}

async function replaceBranchIdentifiers(
  db: DbLike,
  branchId: string,
  identifiers: Array<{ scheme: string; value: string }>,
) {
  await db
    .delete(schema.requisiteProviderBranchIdentifiers)
    .where(eq(schema.requisiteProviderBranchIdentifiers.branchId, branchId));

  if (identifiers.length === 0) {
    return;
  }

  await db.insert(schema.requisiteProviderBranchIdentifiers).values(
    identifiers.map((id) => ({
      branchId,
      scheme: id.scheme,
      value: id.value,
      normalizedValue: id.value.trim().toUpperCase(),
      isPrimary: true,
    })),
  );
}

async function upsertBranch(
  db: DbLike,
  input: {
    providerId: string;
    bic: string;
    info: BicParticipantInfo;
    isPrimary: boolean;
    code: string | null;
  },
): Promise<string> {
  const branchId = uuidv5(input.bic, BRANCH_NAMESPACE);
  const country = nullIfEmpty(input.info.CntrCd);
  const postalCode = nullIfEmpty(input.info.Ind);
  const city = formatCity(input.info.Tnp, input.info.Nnp);
  const rawAddress = nullIfEmpty(input.info.Adr);
  const name = nullIfEmpty(input.info.NameP) ?? input.bic;

  await db
    .insert(schema.requisiteProviderBranches)
    .values({
      id: branchId,
      providerId: input.providerId,
      code: input.code,
      name,
      country,
      postalCode,
      city,
      rawAddress,
      isPrimary: input.isPrimary,
      archivedAt: null,
    })
    .onConflictDoUpdate({
      target: schema.requisiteProviderBranches.id,
      set: {
        providerId: input.providerId,
        code: input.code,
        name,
        country,
        postalCode,
        city,
        rawAddress,
        isPrimary: input.isPrimary,
        archivedAt: null,
      },
    });

  return branchId;
}

export async function seedBicDirectory(
  db: DbLike,
  options: SeedBicDirectoryOptions = {},
) {
  if (process.env.BIC_DIRECTORY_SKIP === "1") {
    console.log("[seed:bic-directory] Skipped via BIC_DIRECTORY_SKIP=1");
    return;
  }

  const resolved = resolveOptions(options);
  const source = resolved.sourceFile || resolved.sourceUrl;
  console.log(`[seed:bic-directory] Loading from ${source}...`);

  const buffer = await resolveSourceBuffer(resolved);
  const xmlBuffer = isZipBuffer(buffer) ? extractXmlFromZip(buffer) : buffer;
  const xml = iconv.decode(xmlBuffer, "win1251");

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    processEntities: false,
  });
  const parsed = parser.parse(xml);
  const root = parsed?.ED807;
  if (!root) {
    throw new Error(
      "[seed:bic-directory] Parsed XML has no ED807 root element",
    );
  }

  const rawEntries = toArray<BicEntry>(root.BICDirectoryEntry);
  const activeEntries = rawEntries.filter(
    (entry) => entry.ParticipantInfo?.ParticipantStatus === "PSAC",
  );
  console.log(
    `[seed:bic-directory] Parsed ${rawEntries.length} entries; ${activeEntries.length} active (PSAC)`,
  );

  const rootsRaw = activeEntries.filter(
    (entry) => !entry.ParticipantInfo?.PrntBIC,
  );
  const childrenRaw = activeEntries.filter(
    (entry) => !!entry.ParticipantInfo?.PrntBIC,
  );

  const existingBicToProviderId = await prefetchExistingBics(db);

  let providersInserted = 0;
  let providersSkipped = 0;
  let branchesInserted = 0;
  let orphansSkipped = 0;

  let rootIndex = 0;
  for (const entry of rootsRaw) {
    const normalizedBic = normalizeBic(entry.BIC);
    const existingProviderId = existingBicToProviderId.get(normalizedBic);

    if (existingProviderId) {
      providersSkipped += 1;
    } else {
      const providerId = await insertRootProvider(db, entry);
      existingBicToProviderId.set(normalizedBic, providerId);
      providersInserted += 1;

      const corrAccount = findCrsaAccount(entry);
      const providerIdentifiers: Array<{ scheme: string; value: string }> = [
        { scheme: "bic", value: entry.BIC },
      ];
      if (corrAccount) {
        providerIdentifiers.push({ scheme: "corr_account", value: corrAccount });
      }
      await replaceProviderIdentifiers(db, providerId, providerIdentifiers);

      const branchId = await upsertBranch(db, {
        providerId,
        bic: entry.BIC,
        info: entry.ParticipantInfo,
        isPrimary: true,
        code: null,
      });
      branchesInserted += 1;

      const branchIdentifiers: Array<{ scheme: string; value: string }> = [
        { scheme: "bic", value: entry.BIC },
      ];
      if (corrAccount) {
        branchIdentifiers.push({ scheme: "corr_account", value: corrAccount });
      }
      await replaceBranchIdentifiers(db, branchId, branchIdentifiers);
    }

    rootIndex += 1;
    if (rootIndex % 1000 === 0) {
      console.log(
        `[seed:bic-directory] Processed ${rootIndex} / ${rootsRaw.length} root entries...`,
      );
    }
  }

  let childIndex = 0;
  for (const entry of childrenRaw) {
    const parentBic = normalizeBic(entry.ParticipantInfo.PrntBIC!);
    const providerId = existingBicToProviderId.get(parentBic);
    if (!providerId) {
      orphansSkipped += 1;
      continue;
    }

    const branchId = await upsertBranch(db, {
      providerId,
      bic: entry.BIC,
      info: entry.ParticipantInfo,
      isPrimary: false,
      code: entry.BIC,
    });
    branchesInserted += 1;

    const corrAccount = findCrsaAccount(entry);
    const branchIdentifiers: Array<{ scheme: string; value: string }> = [
      { scheme: "bic", value: entry.BIC },
    ];
    if (corrAccount) {
      branchIdentifiers.push({ scheme: "corr_account", value: corrAccount });
    }
    await replaceBranchIdentifiers(db, branchId, branchIdentifiers);

    childIndex += 1;
    if (childIndex % 1000 === 0) {
      console.log(
        `[seed:bic-directory] Processed ${childIndex} / ${childrenRaw.length} child entries...`,
      );
    }
  }

  console.log(
    `[seed:bic-directory] Done. Providers inserted: ${providersInserted}, skipped (BIC already existed): ${providersSkipped}, branches inserted: ${branchesInserted}, orphan children skipped: ${orphansSkipped}`,
  );
}
