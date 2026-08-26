# Contributing to WhatsApp Commerce OS

Thank you for contributing to WCO! This document outlines our development standards, processes, and guidelines to ensure code quality, consistency, and maintainability.

## Table of Contents
1. [Code of Conduct](#code-of-conduct)
2. [Development Setup](#development-setup)
3. [Git Workflow](#git-workflow)
4. [Code Style & Conventions](#code-style--conventions)
5. [Commit Messages](#commit-messages)
6. [Pull Request Process](#pull-request-process)
7. [Testing Requirements](#testing-requirements)
8. [Documentation Standards](#documentation-standards)
9. [Security Guidelines](#security-guidelines)
10. [Performance Guidelines](#performance-guidelines)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. All contributors must adhere to our [Code of Conduct](CODE_OF_CONDUCT.md).

## Development Setup

### Prerequisites
- Node.js 20.10.0+ (use `nvm` or `fnm`)
- npm 10.2.0+
- Docker Desktop 4.25+
- Git 2.40+
- VS Code (recommended) with extensions:
  - ESLint
  - Prettier
  - TypeScript Hero
  - Prisma
  - Tailwind CSS IntelliSense

### Initial Setup
```bash
# Clone and install
git clone https://github.com/wco/wco.git
cd wco
npm install

# Setup husky hooks
npm run prepare

# Configure environment
cp .env.example .env
# Edit .env with your local config

# Start infrastructure
npm run docker:up

# Initialize database
npm run db:migrate
npm run db:seed

# Verify setup
npm run dev
```

### Recommended VS Code Settings
Create `.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "eslint.validate": ["typescript", "typescriptreact"],
  "tailwindCSS.includeLanguages": {
    "typescript": "javascript",
    "typescriptreact": "javascript"
  }
}
```

## Git Workflow

### Branching Strategy
We use a modified **GitFlow** with **Trunk-Based Development** for hotfixes:

```
main (production-ready)
  │
  ├── develop (integration branch)
  │     │
  │     ├── feature/JIRA-123-short-description
  │     ├── feature/JIRA-124-another-feature
  │     ├── bugfix/JIRA-125-fix-description
  │     └── release/v1.2.0
  │
  └── hotfix/JIRA-126-critical-fix (from main)
```

### Branch Naming Conventions
| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/JIRA-XXX-short-kebab-case` | `feature/JIRA-123-add-ai-responder` |
| Bugfix | `bugfix/JIRA-XXX-short-kebab-case` | `bugfix/JIRA-124-fix-payment-webhook` |
| Hotfix | `hotfix/JIRA-XXX-short-kebab-case` | `hotfix/JIRA-125-security-patch` |
| Release | `release/vX.Y.Z` | `release/v1.2.0` |
| Chore | `chore/short-description` | `chore/update-dependencies` |

### Branch Protection Rules
- **main**: Requires 2 approvals, all CI checks, linear history
- **develop**: Requires 1 approval, all CI checks
- **release/***: Requires 1 approval, all CI checks

## Code Style & Conventions

### TypeScript
- **Strict mode**: Always enabled
- **Explicit types**: For public APIs, function parameters, returns
- **Type inference**: For local variables, internal logic
- **Interfaces over types**: For object shapes, extensibility
- **No `any`**: Use `unknown` or proper types
- **No `non-null assertions`**: Use proper null checks

```typescript
// Good
interface User {
  id: string;
  email: string;
  name: string;
}

function getUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

// Bad
function getUser(id: any): any {
  return prisma.user.findUnique({ where: { id } });
}
```

### React/Next.js
- **Function components** with hooks
- **Server Components** by default (Next.js App Router)
- **Client Components** only when needed (`"use client"`)
- **Colocation**: Keep components near their usage
- **Compound components** for complex UI
- **Custom hooks** for reusable logic

```typescript
// Good - Server Component by default
async function ProductList({ storeId }: { storeId: string }) {
  const products = await getProducts(storeId);
  return <ProductGrid products={products} />;
}

// Good - Client Component when needed
"use client";
function ProductGrid({ products }: { products: Product[] }) {
  const [filtered, setFiltered] = useState(products);
  // ...
}
```

### NestJS Backend
- **Modular architecture**: Feature modules with clear boundaries
- **Dependency injection**: Constructor injection
- **DTOs**: Class-validator for validation
- **Guards/Interceptors**: Cross-cutting concerns
- **Repository pattern**: Data access abstraction

```typescript
// Good - Module structure
@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductsRepository],
  exports: [ProductsService],
})
export class ProductsModule {}

// Good - Service with repository
@Injectable()
export class ProductsService {
  constructor(private readonly repo: ProductsRepository) {}
  
  async create(dto: CreateProductDto, userId: string): Promise<Product> {
    return this.repo.create({ ...dto, storeId: userId });
  }
}
```

### Naming Conventions
| Entity | Convention | Example |
|--------|------------|---------|
| Files | kebab-case | `user-service.ts`, `product-card.tsx` |
| Classes/Interfaces | PascalCase | `UserService`, `CreateUserDto` |
| Functions/Variables | camelCase | `getUserById`, `userCount` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_ATTEMPTS` |
| Types/Enums | PascalCase | `UserRole`, `OrderStatus` |
| React Components | PascalCase | `ProductCard`, `UserProfile` |
| Hooks | camelCase + `use` | `useProducts`, `useAuth` |
| Database Tables | snake_case | `users`, `order_items` |
| Database Columns | snake_case | `created_at`, `user_id` |

### File Organization
```
feature-module/
├── components/          # React components (UI)
├── hooks/              # Custom React hooks
├── services/           # Business logic, API calls
├── store/              # State management (Zustand)
├── types/              # TypeScript types
├── utils/              # Helper functions
├── validators/         # Zod schemas
├── constants/          # Module constants
└── index.ts            # Public exports
```

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types
| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, missing semicolons, etc. |
| `refactor` | Code change that neither fixes nor adds feature |
| `perf` | Performance improvement |
| `test` | Adding missing tests |
| `chore` | Maintenance, dependencies, build config |
| `ci` | CI/CD changes |
| `security` | Security improvements |

### Examples
```bash
# Feature
feat(auth): add JWT refresh token rotation

# Fix with scope
fix(payments): handle Flutterwave webhook timeout

# Breaking change
feat(api)!: change order response structure

# With body
feat(analytics): add real-time dashboard metrics

Implements WebSocket connection for live updates.
Reduces polling by 90%.

# With footer
fix(security): prevent SQL injection in search
Closes JIRA-123
```

### Commit Message Validation
Husky + commitlint validates messages on commit:
```bash
# Install (done via prepare script)
npm install --save-dev @commitlint/cli @commitlint/config-conventional
```

## Pull Request Process

### PR Requirements
1. **Linked Issue**: Every PR must reference a JIRA ticket
2. **Title Format**: `[JIRA-XXX] Short description`
3. **Description Template**: Use `.github/pull_request_template.md`
4. **Size**: Keep PRs < 400 lines changed (split if larger)
5. **Tests**: All new code must have tests
6. **Documentation**: Update docs for API changes

### PR Template
```markdown
## Description
Brief description of changes

## Related Issue
Closes JIRA-XXX

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update
- [ ] Refactor
- [ ] Performance improvement

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass (if applicable)
- [ ] Manual testing done

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No console.log/debugger left
- [ ] No commented-out code
```

### Review Process
1. **Author**: Self-review before requesting review
2. **Reviewers**: 2 approvals required (1 for bugfixes)
3. **CI Checks**: All must pass
4. **Conflicts**: Resolve before merge
5. **Merge**: Squash and merge to `develop`

### Review Guidelines for Reviewers
- Focus on: correctness, security, performance, maintainability
- Ask questions instead of demanding changes
- Approve when confident, request changes when needed
- Use GitHub review features (comments, suggestions)

## Testing Requirements

### Coverage Targets
| Layer | Target | Critical Paths |
|-------|--------|----------------|
| Unit | 80% | 100% |
| Integration | 70% | 90% |
| E2E | Key flows | 100% |

### Test Structure
```
tests/
├── unit/              # Pure function/class tests
├── integration/       # Module interaction tests
├── e2e/              # Full user journey tests
├── fixtures/         # Test data
├── mocks/            # Mock implementations
└── utils/            # Test helpers
```

### Test Naming
```typescript
// Unit: describe + it
describe('PricingService', () => {
  describe('calculateOptimalPrice', () => {
    it('should return base price when no demand data', () => {});
    it('should increase price when high demand', () => {});
  });
});

// Integration: describe + it
describe('OrdersModule', () => {
  it('should create order and emit OrderCreated event', async () => {});
});

// E2E: describe + test
test('customer can complete purchase flow', async ({ page }) => {});
```

### Running Tests
```bash
# All tests with coverage
npm run test

# Watch mode
npm run test:watch

# Specific project
npm run test --filter=backend
npm run test --filter=frontend

# Debug
npm run test:debug
```

## Documentation Standards

### Code Documentation
- **JSDoc** for public APIs, complex functions
- **README** in every package/module
- **Architecture Decision Records** for significant decisions

```typescript
/**
 * Calculates optimal product price based on demand signals.
 * 
 * @param productId - Unique product identifier
 * @param context - Pricing context (competitor prices, inventory, etc.)
 * @returns Optimal price in local currency (kobo/cents)
 * @throws {PricingError} When insufficient data for calculation
 */
async function calculateOptimalPrice(
  productId: string,
  context: PricingContext
): Promise<number> {
  // ...
}
```

### API Documentation
- **OpenAPI/Swagger** annotations in controllers
- **GraphQL Schema** with descriptions
- **Postman Collection** for external APIs

### Architecture Decision Records (ADR)
Create ADR for:
- New technology adoption
- Major architectural changes
- Security decisions
- Data model changes

Location: `docs/adr/YYYY-MM-DD-short-title.md`

Template:
```markdown
# ADR XXX: Title

## Status
Proposed | Accepted | Superseded

## Context
What problem are we solving?

## Decision
What did we decide?

## Consequences
### Positive
- 

### Negative
- 

## Alternatives Considered
1. 
2. 
```

## Security Guidelines

### Never Commit
- Secrets (API keys, passwords, tokens)
- Personal data (PII)
- Private keys/certificates
- Real user data

### Secure Coding Practices
1. **Input Validation**: Validate all inputs at boundaries
2. **Output Encoding**: Prevent XSS
3. **Parameterized Queries**: Prevent SQL injection
4. **Authentication**: Verify every request
5. **Authorization**: Check permissions per resource
6. **Rate Limiting**: Protect endpoints
7. **Logging**: No sensitive data in logs
8. **Dependencies**: Audit regularly (`npm audit`)

### Security Review
- All PRs with auth/payments/data changes require security review
- Use `npm audit` and `snyk test` in CI
- Rotate secrets quarterly

## Performance Guidelines

### Frontend
- **Bundle size**: < 200KB initial JS
- **LCP**: < 2.5s
- **TTI**: < 3.5s
- **CLS**: < 0.1
- **Code splitting**: Route-level + component-level
- **Images**: WebP, lazy loading, responsive

### Backend
- **Response time**: p95 < 200ms
- **Database**: Connection pooling, indexes, query optimization
- **Caching**: Redis for frequent reads
- **Pagination**: Cursor-based for large datasets
- **Background jobs**: Async processing for heavy tasks

### Database
- **Indexes**: On foreign keys, query columns
- **Migrations**: Reversible, tested
- **Seeding**: Deterministic, idempotent

## Release Process

### Versioning
[Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`

### Release Checklist
- [ ] All PRs merged to `develop`
- [ ] Release branch created: `release/vX.Y.Z`
- [ ] Version bumped in `package.json`
- [ ] Changelog updated (`CHANGELOG.md`)
- [ ] Staging deployment verified
- [ ] Performance benchmarks pass
- [ ] Security scan passes
- [ ] Release notes drafted
- [ ] Merge to `main` with tag
- [ ] Production deployment
- [ ] Post-deploy verification

## Getting Help

- **Slack**: #wco-dev, #wco-frontend, #wco-backend, #wco-ai
- **Office Hours**: Tuesdays 2pm UTC
- **Documentation**: https://docs.wco.com
- **Architecture Questions**: Create RFC in `docs/adr/`

## Recognition

Contributors are recognized in:
- Release notes
- Contributors page
- Annual contributor awards

---

**Remember**: We're building a billion-dollar company. Every line of code matters. Write code you're proud of.