import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getServerEnv } from "@/env";
import * as schema from "@/db/schema";

const globalForDatabase = globalThis as unknown as {
  stockErpSql?: ReturnType<typeof postgres>;
};

function createSqlClient() {
  return postgres(getServerEnv().DATABASE_URL, {
    max: process.env.NODE_ENV === "development" ? 5 : 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
}

export const sql = globalForDatabase.stockErpSql ?? createSqlClient();

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.stockErpSql = sql;
}

export const db = drizzle(sql, { schema });
