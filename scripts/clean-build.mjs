import { rmSync } from "node:fs";

for (const target of ["bin", "esm", "mcp-server.mcpb"]) {
  rmSync(target, { recursive: true, force: true });
}
