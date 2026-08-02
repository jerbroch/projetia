import { config } from "dotenv";
import { defineConfig } from "prisma/config";
import { configureDatabaseEnv } from "./scripts/database-url";

config({ path: ".env.local" });
config({ path: ".env" });

const databaseUrl = configureDatabaseEnv();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl,
  },
});
