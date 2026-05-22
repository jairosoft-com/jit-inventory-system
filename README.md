# JIT Inventory & Equipment Management System

A web-based internal tool for managing the full lifecycle of Jairosoft Inc. / LLC assets — from procurement through disposal — and handling equipment borrowing through a structured digital workflow.

## Tech Stack

| Layer                | Technology               | Notes                                                     |
| -------------------- | ------------------------ | --------------------------------------------------------- |
| **Frontend**         | Next.js (App Router)     | React framework with SSR and server components            |
| **Styling**          | Tailwind CSS + shadcn/ui | Utility-first CSS with pre-built component library        |
| **Backend**          | NestJS                   | Node.js framework with modular architecture               |
| **ORM**              | Prisma                   | Type-safe database client for PostgreSQL                  |
| **Database**         | PostgreSQL via Supabase  | Hosted relational DB                                      |
| **File Storage**     | Supabase Storage         | Images, warranty documents, attachments                   |
| **Authentication**   | Custom NestJS JWT        | Two-token strategy (AT in memory + RT in httpOnly cookie) |
| **State Management** | Zustand                  | Access token in memory (never localStorage)               |
| **HTTP Client**      | Axios                    | With response interceptor for token refresh               |

## Project Structure

```
jit-inventory-system/
├── apps/
│   ├── frontend/         # Next.js application
│   └── backend/          # NestJS application
├── packages/
│   └── shared/           # Shared types and constants
├── prisma/
│   ├── schema.prisma     # Database schema (single source of truth)
│   └── seed.ts           # RBAC seed data
├── .github/
│   └── workflows/
│       └── ci.yml        # CI/CD pipeline
├── turbo.json            # Turborepo configuration
├── package.json          # Root workspace configuration
└── tsconfig.base.json    # Shared TypeScript config
```

## Prerequisites

- **Node.js** >= 20.0.0
- **npm** >= 10.0.0
- **PostgreSQL** database (or Supabase project)
- **Git**

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/jairosoft-com/jit-inventory-system.git
cd jit-inventory-system
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — Secret keys for JWT tokens
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` — Supabase project credentials

### 4. Setup Database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed RBAC data (roles, permissions, role-permission mappings)
npm run db:seed
```

### 5. Start Development

```bash
# Start both frontend and backend concurrently
npm run dev
```

- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:3001/api](http://localhost:3001/api)

### Individual Apps

```bash
# Frontend only
npm run dev --workspace=apps/frontend

# Backend only
npm run dev --workspace=apps/backend
```

## Available Scripts

| Script                | Description                        |
| --------------------- | ---------------------------------- |
| `npm run dev`         | Start all apps in development mode |
| `npm run build`       | Build all apps for production      |
| `npm run lint`        | Lint all workspaces                |
| `npm run format`      | Format code with Prettier          |
| `npm run db:generate` | Generate Prisma client             |
| `npm run db:migrate`  | Run database migrations            |
| `npm run db:seed`     | Seed RBAC data                     |
| `npm run db:studio`   | Open Prisma Studio (database GUI)  |

## Environment Variables

See [`.env.example`](.env.example) for the complete list of required environment variables.

## User Roles

The system uses database-driven RBAC with three seeded roles:

| Role        | Description                                             |
| ----------- | ------------------------------------------------------- |
| **Admin**   | Full system access — unrestricted                       |
| **Manager** | Operational authority — inventory and borrow management |
| **Staff**   | End-user access — browse and self-request only          |

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our development workflow, branch naming conventions, and pull request process.

## License

This project is for internal use only. Confidential.
