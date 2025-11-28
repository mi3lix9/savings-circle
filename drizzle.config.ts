import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./src/drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "sqlite:sqlite.db",
  },
});
