import { execSync } from 'node:child_process';

const run = (cmd) => {
  console.log(`[vercel-backend-build] ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
};

run('node node_modules/prisma/build/index.js generate --schema packages/database/prisma/schema.prisma');
run('npm run build --workspace=@wco/backend');
run('node -e "const { PrismaClient } = require(\'@prisma/client\'); const p = new PrismaClient(); p.$executeRawUnsafe(\'CREATE EXTENSION IF NOT EXISTS vector\').then(() => { console.log(\'pgvector extension ok\'); return p.$disconnect(); }).catch((e) => { console.error(e); process.exit(1); });"');
run('node node_modules/prisma/build/index.js db push --accept-data-loss --skip-generate --schema packages/database/prisma/schema.prisma');
run('node node_modules/tsx/dist/cli.mjs packages/database/prisma/seed.ts');