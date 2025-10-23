#!/usr/bin/env node

import { startServer } from "./server";

startServer().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start Claude Agent MCP server:", error);
  process.exit(1);
});
