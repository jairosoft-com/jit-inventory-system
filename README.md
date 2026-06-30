# JIT Inventory & Equipment Management System

A web-based internal tool for managing the full lifecycle of Jairosoft Inc. / LLC assets — from procurement through disposal — and handling equipment borrowing through a structured digital workflow.

## Tech Stack

| Layer                | Technology            | Notes                                                     |
| -------------------- | --------------------- | --------------------------------------------------------- |
| **Frontend**         | Vite + React 19       | Fast single-page application with React Router v7         |
| **Styling**          | Vanilla CSS           | Modern, responsive CSS with CSS custom properties         |
| **Backend**          | Express + TypeScript  | Lightweight, modular, and fast Node.js backend            |
| **ORM**              | Prisma                | Type-safe database client for PostgreSQL                  |
| **Database**         | PostgreSQL (Docker)   | Local or shared relational database                       |
| **File Storage**     | MinIO (S3-compatible) | Local or shared file/image storage                        |
| **Authentication**   | Custom Express JWT    | Two-token strategy (AT in memory + RT in httpOnly cookie) |
| **State Management** | Zustand               | Access token in memory (never localStorage)               |
| **HTTP Client**      | Axios                 | With request/response interceptors for token refresh      |

## Project Structure

```
jit-inventory-system/
├── apps/
│   ├── frontend/         # Vite + React 19 application
│   └── backend/          # Express + TypeScript application
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
- **Docker & Docker Compose** (for database, S3 storage, and mail capture)
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

### 3. Start Infrastructure

Start the local development PostgreSQL, MinIO, and MailDev services using Docker Compose:

```bash
docker compose up -d
```

### 4. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

- `DATABASE_URL` — PostgreSQL connection string (defaults to `localhost` but can point to a shared machine's IP)
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — Secret keys for signing JWT tokens
- `ENCRYPTION_KEY` — Key for symmetric license key encryption (min 32 characters)
- `S3_ENDPOINT` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `S3_BUCKET` — MinIO configuration
- `SMTP_HOST` / `SMTP_PORT` — MailDev local mail capture configuration

### 5. Setup Database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations (against the Docker database)
npm run db:migrate

# Seed RBAC data (roles, permissions, default admin user)
npm run db:seed
```

### 6. Start Development

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
