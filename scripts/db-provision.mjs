import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const run = (cmd) => {
  console.log(`[db-provision] ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
};

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to provision the database');
}

run('node scripts/bootstrap-pgvector.mjs');
run('node node_modules/prisma/build/index.js db push --accept-data-loss --skip-generate --schema packages/database/prisma/schema.prisma');
run('node node_modules/tsx/dist/cli.mjs packages/database/prisma/seed.ts');