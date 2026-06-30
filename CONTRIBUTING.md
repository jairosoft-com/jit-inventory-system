# Contributing to JIT Inventory & Equipment Management System

Thank you for contributing! This document outlines the development workflow and conventions for the team.

## Branch Naming Convention

Use the following prefixes for branch names:

| Prefix      | Purpose                                  | Example                                |
| ----------- | ---------------------------------------- | -------------------------------------- |
| `feature/`  | New features or functionality            | `feature/borrow-workflow`              |
| `bugfix/`   | Bug fixes                                | `bugfix/stock-quantity-race-condition` |
| `hotfix/`   | Critical production fixes                | `hotfix/auth-token-refresh`            |
| `chore/`    | Non-code changes (CI, docs, configs)     | `chore/update-ci-pipeline`             |
| `refactor/` | Code refactoring without behavior change | `refactor/prisma-service-cleanup`      |

### Branch Flow

```
main ← develop ← feature/your-feature
```

- **`main`** — Production-ready code. Protected branch.
- **`develop`** — Integration branch. All PRs target this branch.
- **Feature branches** — Created from `develop`, merged back via PR.

## Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type       | Description                                       |
| ---------- | ------------------------------------------------- |
| `feat`     | New feature                                       |
| `fix`      | Bug fix                                           |
| `docs`     | Documentation changes                             |
| `style`    | Code style changes (formatting, semicolons, etc.) |
| `refactor` | Code refactoring                                  |
| `test`     | Adding or updating tests                          |
| `chore`    | Build process, CI, or tooling changes             |
| `perf`     | Performance improvements                          |

### Scopes

Use the app or module name: `frontend`, `backend`, `prisma`, `shared`, `auth`, `inventory`, `equipment`, `borrow`, etc.

### Examples

```
feat(backend): implement JWT refresh token rotation
fix(inventory): prevent stock quantity from going below zero
docs(readme): add environment variable documentation
chore(ci): add type-check step to GitHub Actions pipeline
```

## Pull Request Process

1. **Create a branch** from `develop` using the naming convention above
2. **Make your changes** with clear, focused commits
3. **Ensure CI passes** — linting, type-checking, and build must succeed
4. **Write a clear PR description** explaining what changed and why
5. **Request review** from at least one team member
6. **Address feedback** promptly
7. **Squash merge** into `develop` when approved

### PR Checklist

- [ ] Branch follows naming convention
- [ ] Commits follow conventional commits format
- [ ] Code compiles without errors (`npm run build`)
- [ ] Linting passes (`npm run lint`)
- [ ] No `console.log` statements (use `console.warn` or `console.error` if needed)
- [ ] Prisma schema changes include a migration
- [ ] New API endpoints are documented
- [ ] Environment variables are documented in `.env.example`

## Code Style

- **TypeScript strict mode** is enabled — fix all type errors
- **Prettier** handles formatting — run `npm run format` before committing
- **ESLint** catches code issues — run `npm run lint` to check
- Use **camelCase** for TypeScript variables and functions
- Use **snake_case** for database columns (Prisma `@map` handles the conversion)
- Use **PascalCase** for classes, interfaces, and enums

## Database Changes

When changing the database schema:

1. Update `prisma/schema.prisma`.
2. Generate a local migration: `npm run db:migrate` (runs `prisma migrate dev` against your local database).
3. If adding seed data, update `prisma/seed.ts`.
4. Commit the schema updates and the generated migration files.
5. In your PR description, **explicitly state that this PR contains database migrations**.
6. Once the PR is approved and merged to `develop`, **the author of the PR is responsible for running `npx prisma migrate deploy` against the shared database host** (if using a shared database instance) so that the central database schema stays in sync.
7. Teammates pulling the latest `develop` branch must run:
   ```bash
   npx prisma migrate deploy
   ```
   If there are new roles, permissions, or system metadata added, run the seed script:
   ```bash
   npx prisma db seed
   ```

## Project Structure Guidelines

- **Backend Architecture**: Structured as a clean Express application:
  - **Routes** (`src/routes/`): Defines HTTP endpoints, applies validation/authorization middlewares, and delegates to service logic.
  - **Services** (`src/services/`): Handles core business logic, validation logic, and database operations using Prisma.
  - **Middlewares** (`src/middleware/`): Holds route guards, specifically `authenticate` (JWT processing), `authorize` (RBAC checking), and `validate` (Zod schema checking).
  - **Schemas** (`src/schemas/`): Zod schemas for payload validation.
  - **Types** (`src/types/`): Application-wide TypeScript interfaces and extensions.
- **Shared types**: Cross-app types, utilities, and constants go in `packages/shared/`.

## Questions?

Reach out to the team lead or open a discussion in the repository.
