import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Load environment variables from .env file
config();

export default defineConfig({
  schema: "src/prisma/schema.prisma",
  migrations: {
    path: "src/prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
