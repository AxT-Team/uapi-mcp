# Dockerfile for uapi-mcp.
# Used by the Smithery deployment manifest (smithery.yaml).
FROM node:20-bullseye-slim

WORKDIR /app

ENV NODE_ENV=production
ENV CI=1

# Install just the npm package (and its deps). The package's prepublishOnly
# script bundles the server into ./bin/mcp-server.js, so a fresh `npm install`
# of the published version pulls down a runnable build.
RUN npm install -g uapi-mcp@latest

# Smithery runs MCP servers over stdio.
ENTRYPOINT ["uapi-mcp", "start", "--mode", "dynamic"]
