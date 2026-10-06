import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

const client = postgres(databaseUrl, {
  max: 1,
  prepare: false,
  connect_timeout: 20,
});

try {
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  console.log("Database migrations are current.");
} finally {
  await client.end();
}
