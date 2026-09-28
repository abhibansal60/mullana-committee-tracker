import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

function isLocalDatabase(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

function createNeonDb(url: string) {
  return drizzle(neon(url), { schema });
}
type Db = ReturnType<typeof createNeonDb>;

function createDb(): Db {
  const url = process.env.DATABASE_URL!;
  // Production (and any Neon branch) talks to Neon over HTTP. A plain local
  // Postgres (e.g. `postgres://dev:dev@localhost/committee`) can't speak that
  // protocol, so local dev/QA falls back to node-postgres. The query-builder
  // API is the same for everything this app uses (no db.batch/transactions),
  // so the cast is safe.
  if (isLocalDatabase(url)) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("pg") as typeof import("pg");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle: drizzlePg } = require("drizzle-orm/node-postgres") as typeof import("drizzle-orm/node-postgres");
    const pool = new Pool({ connectionString: url, max: 10 });
    return drizzlePg(pool, { schema }) as unknown as Db;
  }
  return createNeonDb(url);
}

export const db = createDb();
