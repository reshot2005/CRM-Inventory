# StockOS API

**Production-grade NestJS backend for inventory management.**

StockOS API is a comprehensive, enterprise-ready backend service powering end-to-end inventory management — from procurement and warehousing to manufacturing, sales, and reporting. Built with a modular architecture, strict TypeScript, and battle-tested libraries.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 10 |
| Language | TypeScript 5 (strict mode) |
| ORM | Prisma 5 |
| Database | PostgreSQL 15 |
| Authentication | JWT (access + refresh tokens) |
| Authorization | Role-Based Access Control (RBAC) |
| Two-Factor Auth | TOTP (RFC 6238) |
| Caching / Sessions | Redis 6+ |
| Rate Limiting | Redis-backed throttler |
| API Docs | Swagger / OpenAPI 3.0 |

---

## Prerequisites

Ensure the following are installed and running before you begin:

- **Node.js** — v18 or later
- **npm** — v9 or later (ships with Node 18+)
- **PostgreSQL** — v15 or later
- **Redis** — v6 or later

---

## Installation

```bash
cd stockos-api
npm install
```

---

## Environment Setup

```bash
cp .env.example .env
```

Open `.env` and configure the variables below:

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/stockos` |
| `JWT_SECRET` | Secret key for signing access tokens | `your-jwt-secret-key` |
| `JWT_REFRESH_SECRET` | Secret key for signing refresh tokens | `your-refresh-secret-key` |
| `JWT_EXPIRATION` | Access token lifetime | `15m` |
| `JWT_REFRESH_EXPIRATION` | Refresh token lifetime | `7d` |
| `REDIS_HOST` | Redis server hostname | `localhost` |
| `REDIS_PORT` | Redis server port | `6379` |
| `REDIS_PASSWORD` | Redis password (leave empty if none) | ` ` |
| `PORT` | Port the API server listens on | `3001` |
| `NODE_ENV` | Runtime environment | `development` |
| `THROTTLE_TTL` | Rate-limit window in seconds | `60` |
| `THROTTLE_LIMIT` | Max requests per window | `100` |
| `TWO_FACTOR_APP_NAME` | Label shown in authenticator apps | `StockOS` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:3000` |

---

## Database Setup

Generate the Prisma client, run migrations, and seed initial data:

```bash
npx prisma generate
npx prisma migrate dev --name init
npm run seed
```

To view and explore your database with Prisma Studio:

```bash
npx prisma studio
```

---

## Running

### Development

```bash
npm run start:dev
```

The server starts on `http://localhost:3001` with hot-reload enabled.

### Production

```bash
npm run build
npm run start
```

---

## API Documentation

Interactive Swagger UI is auto-generated from controller decorators.

| Resource | URL |
|---|---|
| Swagger UI | [http://localhost:3001/api/docs](http://localhost:3001/api/docs) |
| OpenAPI JSON | [http://localhost:3001/api/docs-json](http://localhost:3001/api/docs-json) |
| Health Check | `GET http://localhost:3001/health` |

---

## Default Login Credentials

The seed script creates four users for testing:

| Email | Password | Role | Status |
|---|---|---|---|
| `admin@stockos.com` | `Admin@123` | ADMIN | ACTIVE |
| `manager@stockos.com` | `Manager@123` | MANAGER | ACTIVE |
| `staff@stockos.com` | `Staff@123` | STAFF | ACTIVE |
| `viewer@stockos.com` | `Viewer@123` | VIEWER | ACTIVE |

> **Warning** — Change all default passwords immediately in production environments.

---

## API Endpoints

All endpoints are prefixed with `/api/v1`.

| Module | Base Path | Endpoints |
|---|---|---|
| **Auth** | `/api/v1/auth` | `register` · `login` · `verify-2fa` · `refresh` · `logout` · `me` · `setup-2fa` · `enable-2fa` · `disable-2fa` · `change-password` |
| **Users** | `/api/v1/users` | `list` · `pending` · `get` · `approve` · `reject` · `suspend` · `update` · `delete` |
| **Items** | `/api/v1/items` | `list` · `get` · `create` · `update` · `delete` · `stock` · `ledger` · `low-stock` |
| **Move Orders** | `/api/v1/move-orders` | `list` · `get` · `create` · `approve` · `dispatch` · `complete` · `cancel` |
| **Ledger** | `/api/v1/ledger` | `list` · `export CSV` |
| **Adjustments** | `/api/v1/adjustments` | `list` · `create` · `approve` · `reject` |
| **Locations** | `/api/v1/locations` | `list` · `create` |
| **BOMs** | `/api/v1/boms` | `list` · `get` · `create` · `update` · `delete` · `calculate` |
| **Production** | `/api/v1/production-orders` | `list` · `get` · `create` · `start` · `complete` · `cancel` · `summary` |
| **Vendors** | `/api/v1/vendors` | `list` · `get` · `create` · `update` · `delete` · `contacts` · `purchase-orders` |
| **Customers** | `/api/v1/customers` | `list` · `get` · `create` · `update` · `delete` · `orders` · `balance` · `activity` · `contacts` |
| **Purchase Orders** | `/api/v1/purchase-orders` | `list` · `get` · `create` · `update` · `receive` |
| **Sale Orders** | `/api/v1/sale-orders` | `list` · `get` · `create` · `confirm` · `dispatch` · `deliver` · `cancel` |
| **Challans** | `/api/v1/challans` | `list` · `get` · `create` · `pdf` |
| **Payments** | `/api/v1/payments` | `create` · `by-order` · `outstanding` |
| **Reports** | `/api/v1/reports` | `dashboard-kpis` · `stock-summary` · `low-stock` · `stock-valuation` · `movement-trend` · `sales-summary` · `purchase-summary` · `production-summary` · `audit-log` |

---

## Authentication Flow

StockOS uses a **JWT-based authentication flow** with optional two-factor authentication:

```
Register ──► Admin Approval ──► Login ──► Access Token + Refresh Token
                                  │
                                  ├── (if 2FA enabled) ──► Verify TOTP ──► Tokens issued
                                  │
                                  └── (if 2FA disabled) ──► Tokens issued immediately
```

1. **Register** — A new user submits registration details. Their account is created with a `PENDING` status.
2. **Admin Approval** — An administrator reviews and approves (or rejects) the pending account. Only approved users can log in.
3. **Login** — The user authenticates with email and password. If 2FA is not enabled, an access token and refresh token are returned immediately.
4. **2FA Verification** — If 2FA is enabled on the account, the login response includes a temporary token. The user must submit a valid TOTP code from their authenticator app to receive the actual access and refresh tokens.
5. **Access Token** — Short-lived JWT (default 15 minutes) included as a `Bearer` token in the `Authorization` header for every API request.
6. **Refresh Rotation** — When the access token expires, the client sends the refresh token to `/auth/refresh` to obtain a new access/refresh token pair. The old refresh token is invalidated (rotation), preventing reuse.
7. **Logout** — Invalidates the current refresh token and clears the server-side session in Redis.

### Setting Up 2FA

```
POST /auth/setup-2fa    →  Returns QR code URI + secret
POST /auth/enable-2fa   →  Verify TOTP code to activate
POST /auth/disable-2fa  →  Deactivate 2FA with password confirmation
```

---

## Role-Based Access Control

Every authenticated request is evaluated against the user's role. Permissions are enforced at the guard level.

| Permission | ADMIN | MANAGER | STAFF | VIEWER |
|---|:---:|:---:|:---:|:---:|
| View dashboard & reports | ✅ | ✅ | ✅ | ✅ |
| View items & stock levels | ✅ | ✅ | ✅ | ✅ |
| Create / edit items | ✅ | ✅ | ✅ | ❌ |
| Delete items | ✅ | ✅ | ❌ | ❌ |
| Create move orders | ✅ | ✅ | ✅ | ❌ |
| Approve move orders | ✅ | ✅ | ❌ | ❌ |
| Create stock adjustments | ✅ | ✅ | ✅ | ❌ |
| Approve stock adjustments | ✅ | ✅ | ❌ | ❌ |
| Manage BOMs & production | ✅ | ✅ | ❌ | ❌ |
| Create purchase / sale orders | ✅ | ✅ | ✅ | ❌ |
| Manage vendors & customers | ✅ | ✅ | ✅ | ❌ |
| Create challans & payments | ✅ | ✅ | ✅ | ❌ |
| Manage users | ✅ | ❌ | ❌ | ❌ |
| Approve / reject registrations | ✅ | ❌ | ❌ | ❌ |
| System configuration | ✅ | ❌ | ❌ | ❌ |

---

## Project Structure

```
src/
├── main.ts                        # Application entry point
├── app.module.ts                  # Root module
├── app.controller.ts              # Health check & root routes
├── config/                        # Configuration files & validation
├── common/
│   ├── decorators/                # Custom decorators (Roles, CurrentUser, Public)
│   ├── guards/                    # JwtAuthGuard, RolesGuard, ThrottlerGuard
│   ├── interceptors/              # Response transform, logging, timeout
│   ├── filters/                   # Global exception filters
│   ├── pipes/                     # Validation & transformation pipes
│   ├── middleware/                 # Logger, correlation-id middleware
│   └── types/                     # Shared TypeScript interfaces & enums
├── modules/
│   ├── auth/                      # Authentication, JWT, 2FA (TOTP)
│   ├── users/                     # User management & approval workflow
│   ├── inventory/                 # Items, locations, stock, move orders, ledger, adjustments
│   ├── manufacturing/             # BOMs, production orders
│   ├── crm/                       # Vendors, customers, contacts
│   ├── sales/                     # Sale orders, challans, payments
│   └── reports/                   # Dashboard KPIs, stock reports, audit log
├── prisma/                        # Prisma schema, migrations, seed script
└── redis/                         # Redis module, session service, cache utilities
```

---

## Available Scripts

| Script | Command | Description |
|---|---|---|
| **start** | `npm run start` | Start the application |
| **start:dev** | `npm run start:dev` | Start in watch mode (hot-reload) |
| **start:debug** | `npm run start:debug` | Start in debug mode with inspector |
| **start:prod** | `npm run start:prod` | Start the compiled production build |
| **build** | `npm run build` | Compile TypeScript to JavaScript |
| **lint** | `npm run lint` | Run ESLint across the codebase |
| **lint:fix** | `npm run lint:fix` | Run ESLint and auto-fix issues |
| **format** | `npm run format` | Format code with Prettier |
| **test** | `npm run test` | Run unit tests with Jest |
| **test:watch** | `npm run test:watch` | Run tests in watch mode |
| **test:cov** | `npm run test:cov` | Run tests with coverage report |
| **test:e2e** | `npm run test:e2e` | Run end-to-end tests |
| **seed** | `npm run seed` | Seed the database with initial data |
| **prisma:generate** | `npm run prisma:generate` | Generate Prisma client |
| **prisma:migrate** | `npm run prisma:migrate` | Run pending database migrations |
| **prisma:studio** | `npm run prisma:studio` | Open Prisma Studio GUI |

---

## License

This project is proprietary and confidential. Unauthorized copying, distribution, or modification is strictly prohibited.
