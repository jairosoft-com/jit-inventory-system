# Contributing to JIT Inventory & Equipment Management System

Thank you for contributing! This document outlines the development workflow and conventions for the team.

## Branch Naming Convention

Use the following prefixes for branch names:

| Prefix | Purpose | Example |
|---|---|---|
| `feature/` | New features or functionality | `feature/borrow-workflow` |
| `bugfix/` | Bug fixes | `bugfix/stock-quantity-race-condition` |
| `hotfix/` | Critical production fixes | `hotfix/auth-token-refresh` |
| `chore/` | Non-code changes (CI, docs, configs) | `chore/update-ci-pipeline` |
| `refactor/` | Code refactoring without behavior change | `refactor/prisma-service-cleanup` |

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

| Type | Description |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Code style changes (formatting, semicolons, etc.) |
| `refactor` | Code refactoring |
| `test` | Adding or updating tests |
| `chore` | Build process, CI, or tooling changes |
| `perf` | Performance improvements |

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

1. Update `prisma/schema.prisma`
2. Run `npm run db:migrate` to generate a migration
3. If adding seed data, update `prisma/seed.ts`
4. Commit both the schema and migration files

## Project Structure Guidelines

- **Backend modules**: One directory per feature (e.g., `src/auth/`, `src/inventory/`)
- Each module contains: `*.module.ts`, `*.service.ts`, `*.controller.ts`, and optional `dto/` and `entities/` subdirectories
- **Shared code**: Common guards, decorators, and interceptors go in `src/common/`
- **Shared types**: Cross-app types and constants go in `packages/shared/`

## Questions?

Reach out to the team lead or open a discussion in the repository.
