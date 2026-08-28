import { execSync } from 'node:child_process';

const run = (cmd) => {
  console.log(`[vercel-backend-build] ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
};

run('node node_modules/prisma/build/index.js generate --schema packages/database/prisma/schema.prisma');
run('npm run build --workspace=@wco/backend');

console.log('[vercel-backend-build] Database provisioning is decoupled from the deploy (run: npm run db:provision).');