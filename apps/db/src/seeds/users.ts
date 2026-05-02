import { and, eq } from "drizzle-orm";
import { createHash } from "node:crypto";

import type { Database } from "../client";
import { schema } from "../schema-registry";
import { isProductionLikeSeedEnv } from "./runtime";

export type HashPasswordFn = (password: string) => Promise<string>;

export const USER_IDS = {
  ADMIN: "00000000-0000-4000-8000-000000000901",
  FINANCE: "00000000-0000-4000-8000-000000000902",
  OPERATOR: "00000000-0000-4000-8000-000000000903",
} as const;

const ACCOUNT_IDS = {
  ADMIN: "00000000-0000-4000-8000-000000000911",
  FINANCE: "00000000-0000-4000-8000-000000000912",
  OPERATOR: "00000000-0000-4000-8000-000000000913",
} as const;

interface UserSeed {
  id: string;
  accountId: string;
  name: string;
  email: string;
  role: string;
  password: string;
}

const USER_SEEDS: UserSeed[] = [
  {
    id: USER_IDS.ADMIN,
    accountId: ACCOUNT_IDS.ADMIN,
    name: "Admin",
    email: "admin@bedrock.com",
    role: "admin",
    password: "admin123",
  },
  {
    id: USER_IDS.FINANCE,
    accountId: ACCOUNT_IDS.FINANCE,
    name: "Finance",
    email: "finance@bedrock.com",
    role: "finance",
    password: "finance123",
  },
  {
    id: USER_IDS.OPERATOR,
    accountId: ACCOUNT_IDS.OPERATOR,
    name: "Deal Operator",
    email: "operator@bedrock.com",
    role: "agent",
    password: "operator123",
  },
];

type SeedEnv = Record<string, string | undefined>;

function stableUuid(input: string) {
  const hex = createHash("sha256").update(input).digest("hex").slice(0, 32);
  const chars = hex.split("");

  chars[12] = "4";
  chars[16] = ["8", "9", "a", "b"][Number.parseInt(chars[16] ?? "0", 16) % 4]!;

  return [
    chars.slice(0, 8).join(""),
    chars.slice(8, 12).join(""),
    chars.slice(12, 16).join(""),
    chars.slice(16, 20).join(""),
    chars.slice(20, 32).join(""),
  ].join("-");
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function resolveBootstrapAdminIds(input: { email: string; id?: string | null }) {
  if (input.id?.trim()) {
    const id = input.id.trim();
    return {
      accountId: stableUuid(`bootstrap-admin-account:${id}`),
      id,
    };
  }

  const email = normalizeEmail(input.email);
  if (email === "admin@bedrock.com") {
    return {
      accountId: ACCOUNT_IDS.ADMIN,
      id: USER_IDS.ADMIN,
    };
  }

  return {
    accountId: stableUuid(`bootstrap-admin-account:${email}`),
    id: stableUuid(`bootstrap-admin:${email}`),
  };
}

async function hasExistingAdminUser(db: Database): Promise<boolean> {
  const [admin] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.role, "admin"))
    .limit(1);

  return Boolean(admin);
}

async function seedUserRecords(
  db: Database,
  hashPassword: HashPasswordFn,
  seeds: UserSeed[],
  options: { printCreatedCredentials: boolean },
): Promise<void> {
  const created: { email: string; password: string }[] = [];

  for (const seed of seeds) {
    const now = new Date();
    const [existingById] = await db
      .select({ email: schema.user.email, id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.id, seed.id))
      .limit(1);
    const [existingByEmail] = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.email, seed.email))
      .limit(1);
    const [existingCredential] = await db
      .select({ id: schema.account.id })
      .from(schema.account)
      .where(
        and(
          eq(schema.account.providerId, "credential"),
          eq(schema.account.userId, seed.id),
        ),
      )
      .limit(1);
    const passwordHash = await hashPassword(seed.password);

    if (existingByEmail && existingByEmail.id !== seed.id && !existingById) {
      throw new Error(
        `User id mismatch for ${seed.email}: expected ${seed.id}, got ${existingByEmail.id}`,
      );
    }

    if (existingById) {
      await db
        .update(schema.user)
        .set({
          email: seed.email,
          emailVerified: true,
          name: seed.name,
          role: seed.role,
          updatedAt: now,
        })
        .where(eq(schema.user.id, seed.id));

      await db
        .insert(schema.userAccessStates)
        .values({
          userId: seed.id,
          banned: false,
          banReason: null,
          banExpires: null,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.userAccessStates.userId,
          set: {
            banned: false,
            banReason: null,
            banExpires: null,
            updatedAt: now,
          },
        });

      if (seed.role === "admin" || seed.role === "agent") {
        await db
          .insert(schema.agentProfiles)
          .values({
            userId: seed.id,
            status: "active",
            isAllowed: false,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoNothing();
      }

      if (existingCredential) {
        await db
          .update(schema.account)
          .set({
            accountId: seed.id,
            password: passwordHash,
            updatedAt: now,
          })
          .where(eq(schema.account.id, existingCredential.id));
      } else {
        await db.insert(schema.account).values({
          id: seed.accountId,
          accountId: seed.id,
          providerId: "credential",
          userId: seed.id,
          password: passwordHash,
          createdAt: now,
          updatedAt: now,
        });
      }

      continue;
    }

    await db.insert(schema.user).values({
      id: seed.id,
      name: seed.name,
      email: seed.email,
      emailVerified: true,
      role: seed.role,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(schema.account).values({
      id: seed.accountId,
      accountId: seed.id,
      providerId: "credential",
      userId: seed.id,
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    });

    await db
      .insert(schema.userAccessStates)
      .values({
        userId: seed.id,
        banned: false,
        banReason: null,
        banExpires: null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.userAccessStates.userId,
        set: {
          banned: false,
          banReason: null,
          banExpires: null,
          updatedAt: now,
        },
      });

    if (seed.role === "admin" || seed.role === "agent") {
      await db.insert(schema.agentProfiles).values({
        userId: seed.id,
        status: "active",
        isAllowed: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    created.push({ email: seed.email, password: seed.password });
  }

  if (options.printCreatedCredentials && created.length > 0) {
    console.log("\n┌─────────────────────────────────────────┐");
    console.log("│          Seeded user credentials         │");
    console.log("├──────────────────────┬──────────────────┤");
    for (const { email, password } of created) {
      console.log(`│ ${email.padEnd(20)} │ ${password.padEnd(16)} │`);
    }
    console.log("└──────────────────────┴──────────────────┘\n");
  }
}

export async function seedUsers(
  db: Database,
  hashPassword: HashPasswordFn,
): Promise<void> {
  await seedUserRecords(db, hashPassword, USER_SEEDS, {
    printCreatedCredentials: true,
  });
}

export async function seedBootstrapAdminFromEnv(
  db: Database,
  hashPassword: HashPasswordFn,
  env: SeedEnv = process.env,
): Promise<void> {
  const email = env.BEDROCK_BOOTSTRAP_ADMIN_EMAIL?.trim();
  const password = env.BEDROCK_BOOTSTRAP_ADMIN_PASSWORD;

  if (!email || !password) {
    if (isProductionLikeSeedEnv(env)) {
      if (await hasExistingAdminUser(db)) {
        console.warn(
          "[seed:required] Bootstrap admin env is not set; existing admin user found, skipping bootstrap admin.",
        );
        return;
      }

      throw new Error(
        [
          "Bootstrap admin seed requires env credentials in production.",
          "Set BEDROCK_BOOTSTRAP_ADMIN_EMAIL and BEDROCK_BOOTSTRAP_ADMIN_PASSWORD before running db:seed:required.",
        ].join("\n"),
      );
    }

    console.warn(
      "[seed:required] Bootstrap admin env is not set; skipping admin user outside production.",
    );
    return;
  }

  const ids = resolveBootstrapAdminIds({
    email,
    id: env.BEDROCK_BOOTSTRAP_ADMIN_ID,
  });

  await seedUserRecords(
    db,
    hashPassword,
    [
      {
        accountId: ids.accountId,
        email: normalizeEmail(email),
        id: ids.id,
        name: env.BEDROCK_BOOTSTRAP_ADMIN_NAME?.trim() || "Admin",
        password,
        role: "admin",
      },
    ],
    { printCreatedCredentials: false },
  );
}
