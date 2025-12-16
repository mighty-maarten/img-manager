# Tech Stack

## Monorepo Structure

- npm workspaces with packages: `packages/api`, `packages/client`
- Node.js 22+ required (Volta managed)

## Backend (packages/api)

- **Framework**: NestJS 11
- **Database**: PostgreSQL with TypeORM
- **Authentication**: Passport.js with JWT strategy
- **Validation**: class-validator, class-transformer
- **Image Processing**: Sharp
- **Web Scraping**: Cheerio, Axios
- **Logging**: Winston with CloudWatch integration
- **API Documentation**: Swagger (@nestjs/swagger)

## Frontend (packages/client)

- **Framework**: Vue 3 with Composition API
- **Build Tool**: Vite 6
- **State Management**: Pinia
- **UI Components**: PrimeVue 4
- **Forms**: VeeValidate with Yup
- **Routing**: Vue Router 4
- **i18n**: vue-i18n
- **Styling**: SCSS with PrimeVue theming

## Infrastructure

- **IaC**: AWS CDK (TypeScript)
- **Compute**: EC2 (t4g.micro ARM)
- **Storage**: S3 for assets
- **Database**: PostgreSQL (local on EC2)
- **CI/CD**: CodePipeline, CodeDeploy
- **DNS**: Route 53
- **SSL**: Certbot/Let's Encrypt

## Common Commands

```bash
# Development
npm run dev              # Start both client and API
npm run dev:client       # Start client only (Vite)
npm run dev:api          # Start API only (NestJS watch mode)

# Building
npm run build            # Build both packages
npm run build:client     # Build client only
npm run build:api        # Build API only

# Testing
npm run test             # Run all tests
npm run test:client      # Run client unit tests (Vitest)
npm run test:api         # Run API tests (Jest)

# Linting & Formatting
npm run lint             # Lint all packages
npm run format           # Format all packages

# Database (from packages/api)
npm run db:setup:local   # Initialize, migrate, and seed local DB
npm run db:migrate:local # Run migrations only
```

## Environment Variables

- Root `.env.local` for shared config
- `packages/api/.env.local` for API-specific config
- `packages/client/.env.local` for client-specific config (VITE_ prefix required)
