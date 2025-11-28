import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";
import path from "path";

// Load environment variables from .env file
config();

export default defineConfig({
   schema: path.join("src", "prisma"), // ROOT for Prisma
  migrations: {
    path: "src/prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: env("PRODUCTION_DATABASE_URL"),
  },
});
