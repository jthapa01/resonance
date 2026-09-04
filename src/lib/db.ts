import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "./env";

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

// A `prisma+postgres://` URL is Prisma Accelerate and MUST use accelerateUrl;
// the raw pg adapter cannot reach Accelerate and fails with ETIMEDOUT.
// Any other URL is a direct Postgres connection and uses the pg adapter.
const prisma =
  globalForPrisma.prisma ??
  (env.DATABASE_URL.startsWith("prisma+postgres://")
    ? new PrismaClient({ accelerateUrl: env.DATABASE_URL })
    : new PrismaClient({
        adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
      }));

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export { prisma };
