import { execSync } from 'node:child_process';

const run = (cmd) => {
  console.log(`[vercel-backend-build] ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
};

run('node node_modules/prisma/build/index.js generate --schema packages/database/prisma/schema.prisma');
run('npm run build --workspace=@wco/backend');

if (process.env.WCO_RUN_DB_PROVISION === 'true') {
  console.log('[vercel-backend-build] DB provision requested (WCO_RUN_DB_PROVISION=true)');
  run('node scripts/bootstrap-pgvector.mjs');
  run('node node_modules/prisma/build/index.js db push --accept-data-loss --skip-generate --schema packages/database/prisma/schema.prisma');
  if (process.env.WCO_SEED !== 'false') {
    run('node node_modules/tsx/dist/cli.mjs packages/database/prisma/seed.ts');
  }
} else {
  console.log('[vercel-backend-build] Database provisioning is decoupled from the deploy (set WCO_RUN_DB_PROVISION=true to run during build).');
}