#!/usr/bin/env node
/**
 * Module generator — scaffolds a NestJS bounded-context module with the
 * house conventions baked in (guards, DTO validation, outbox-ready service).
 *
 * Usage:
 *   node tools/generators/module.js <module-name>
 *   node tools/generators/module.js inventory
 */
const fs = require('fs');
const path = require('path');

const nameArg = process.argv[2];
if (!nameArg || !/^[a-z][a-z0-9-]*$/.test(nameArg)) {
  console.error('Usage: node tools/generators/module.js <kebab-case-name>');
  process.exit(1);
}

const pascal = nameArg
  .split('-')
  .map((s) => s[0].toUpperCase() + s.slice(1))
  .join('');

const targetDir = path.join(__dirname, '..', '..', 'apps', 'backend', 'src', 'modules', nameArg);
if (fs.existsSync(targetDir)) {
  console.error(`Module already exists: ${targetDir}`);
  process.exit(1);
}

fs.mkdirSync(targetDir, { recursive: true });

const files = {
  [`${nameArg}.module.ts`]: `import { Module } from '@nestjs/common';
import { ${pascal}Controller } from './${nameArg}.controller';
import { ${pascal}Service } from './${nameArg}.service';

@Module({
  controllers: [${pascal}Controller],
  providers: [${pascal}Service],
})
export class ${pascal}Module {}
`,

  [`${nameArg}.controller.ts`]: `import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard, RequirePermissions } from '../../common/guards/tenant.guard';
import { ${pascal}Service } from './${nameArg}.service';

@ApiTags('${nameArg}')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller({ path: '${nameArg}', version: '1' })
export class ${pascal}Controller {
  constructor(private readonly service: ${pascal}Service) {}

  @Get()
  @RequirePermissions('${nameArg}:read')
  list() {
    return this.service.list();
  }

  @Post()
  @RequirePermissions('${nameArg}:create')
  create(@Body() dto: unknown) {
    return this.service.create(dto);
  }
}
`,

  [`${nameArg}.service.ts`]: `import { Injectable } from '@nestjs/common';
import { PrismaService } from '@wco/database';
import { TenantContext } from '../../common/context/tenant-context';

@Injectable()
export class ${pascal}Service {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    const { storeId } = TenantContext.require();
    // TODO: real model + scoping
    return { storeId };
  }

  create(_dto: unknown) {
    TenantContext.require();
    throw new Error('Not implemented');
  }
}
`,
};

for (const [file, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(targetDir, file), content);
}

console.log(`✓ Created apps/backend/src/modules/${nameArg}/`);
console.log('Next steps:');
console.log(`  1. Add ${pascal}Module to app.module.ts imports`);
console.log('  2. Replace TODOs; add DTOs with class-validator decorators');
console.log(`  3. Add permission '${nameArg}:read'/'${nameArg}:create' to role seed`);
