#!/bin/bash
# Webtop agent entrypoint - compiles TypeScript and runs agent

set -e

cd /app

# Compile TypeScript if dist doesn't exist or sources are newer
if [ ! -d "dist" ] || [ "agent.ts" -nt "dist/agent.js" ]; then
  echo "[entrypoint] Compiling TypeScript..."
  npx tsc --target ES2022 --module NodeNext --moduleResolution NodeNext --outDir dist \
    --esModuleInterop --strict --skipLibCheck agent.ts capture.ts zoom-ui.ts
fi

# Run the agent
exec node dist/agent.js