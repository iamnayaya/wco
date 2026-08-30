# Code Style Guide

This guide defines how code is written across the WCO monorepo. Consistency matters: 100+ developers must be able to read each other's code without friction. Lint and format are enforced automatically — this guide explains the *why* behind the rules.

## Principled defaults

- **Prettier** enforces formatting; **ESLint** enforces lint. Run `npm run lint && npm run format` before pushing, or rely on the pre-commit hooks.
- **TypeScript strict mode is always on.** No `any` (use `unknown`), no non-null assertions (`!`) without a documented reason, explicit types on public APIs.
- **Readability > cleverness.** Code is written once and read many times. Prefer obvious over terse.

## Naming conventions

| Entity | Convention | Example |
|---|---|---|
| Files | kebab-case | `user-service.ts`, `product-card.tsx` |
| Classes / Interfaces | PascalCase | `UserService`, `CreateUserDto` |
| Functions / Variables | camelCase | `getUserById`, `userCount` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_ATTEMPTS` |
| Types / Enums | PascalCase | `UserRole`, `OrderStatus` |
| React components | PascalCase | `ProductCard` |
| Hooks | camelCase + `use` | `useProducts` |
| DB tables / columns | snake_case | `users`, `order_items` |

## File organization

Feature modules follow a consistent structure (see [Contributing](../CONTRIBUTING.md)):

```
feature-module/
├── components/      # UI components
├── hooks/           # React hooks
├── services/        # Business logic + API calls
├── store/           # Zustand state
├── types/           # TypeScript types
├── utils/           # Helpers
├── validators/      # Zod / class-validator schemas
├── constants/       # Module constants
└── index.ts         # Public exports (barrel)
```

## TypeScript

```typescript
// Good — explicit public shape, proper types
interface User {
  id: string;
  email: string;
  name: string;
}

async function getUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

// Bad — any, implicit return, non-descriptive
function getUser(id: any) {
  return prisma.user.findUnique({ where: { id } });
}
```

### Rules

- Prefer `interface` over `type` for object shapes (extensibility).
- No `any`; use `unknown` and narrow.
- No non-null assertions; use proper checks, or document with `// NOTE:`.
- Model money as `Prisma.Decimal` in the DB; convert to string at API edges only.

## React / Next.js

- **Function components** with hooks.
- **Server Components by default** (Next.js App Router); use `"use client"` only where interactivity requires it.
- **Colocate** components near their usage.
- Use **compound components** for complex UI; **custom hooks** for reusable logic.
- Prefer TanStack Query for server state; Zustand for client/global state.

## NestJS backend

- **Modular architecture** with clear boundaries (`@Module` imports/controllers/providers).
- **Constructor injection** for DI.
- **DTOs with class-validator** on every endpoint; whitelist mode strips unknown fields.
- **Guards/interceptors** for cross-cutting concerns (auth, tenancy, logging).
- **Repository pattern** for data access abstraction.

```typescript
@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductsRepository],
  exports: [ProductsService],
})
export class ProductsModule {}

@Injectable()
export class ProductsService {
  constructor(private readonly repo: ProductsRepository) {}

  async create(dto: CreateProductDto, userId: string): Promise<Product> {
    return this.repo.create({ ...dto, storeId: userId });
  }
}
```

## Tenancy (non-negotiable)

Every query touching tenant data **must** scope by `storeId` from the `TenantContext`. This is reviewed at code review and enforced by RLS in the database ([ADR-003](../adr/ADR-003-multi-tenancy.md)).

```typescript
const storeId = tenantContext.getStoreId();
return this.repo.findMany({ where: { storeId } });
```

## Events (non-negotiable)

State changes that trigger side effects **must** emit domain events via the transactional outbox, never publish directly to the queue ([ADR-002](../adr/ADR-002-transactional-outbox.md)).

## Error handling (backend)

- Throw NestJS built-ins: `NotFoundException`, `BadRequestException`, etc.
- **Never** return `{ error: ... }` manually or swallow exceptions silently.
- Expose stable machine error `code`s for API consumers.

## Comments

- **Don't comment the obvious.** Comment the *why*, not the *what*.
- Use `// NOTE:` for non-obvious decisions and `// PERF:` for performance rationale.
- No commented-out code in PRs.
- JSDoc/TSDoc for public APIs, complex functions, and exported types.

## Git hygiene

- Conventional commits (`feat(scope): ...`), enforced by commitlint.
- No secrets, PII, private keys, or real user data — ever (gitleaks scans CI).
- See [Git workflow](./06-git-workflow.md) and [Contributing](../CONTRIBUTING.md).

Next: [Git workflow](./06-git-workflow.md).
