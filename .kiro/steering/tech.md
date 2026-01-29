# Tech Stack

## Runtime Requirements

- Node.js >= 22.0.0
- npm >= 10.0.0
- PostgreSQL database
- S3-compatible storage (production)

## Backend (packages/api)

- **Framework**: NestJS 11
- **Database**: TypeORM with PostgreSQL
- **Auth**: Passport.js with JWT strategy
- **Validation**: class-validator, class-transformer
- **Image Processing**: Sharp
- **Web Scraping**: Cheerio, Axios
- **Logging**: Winston with CloudWatch support
- **API Docs**: Swagger (@nestjs/swagger)
- **Testing**: Jest, fast-check (property-based testing)

## Frontend (packages/client)

- **Framework**: Vue 3 with Composition API
- **Build**: Vite 6
- **State**: Pinia
- **UI Components**: PrimeVue 4
- **Forms**: VeeValidate with Yup
- **HTTP**: Axios
- **i18n**: vue-i18n
- **Styling**: SCSS with PostCSS
- **Testing**: Vitest

## Infrastructure

- **IaC**: AWS CDK (TypeScript)
- **Deployment**: CodeDeploy with EC2
- **Storage**: S3
- **Notifications**: SNS

## Common Commands

```bash
# Root level
npm run dev              # Start both client and API in dev mode
npm run build            # Build both packages
npm run test             # Run all tests
npm run lint             # Lint all packages
npm run clean            # Remove node_modules and dist

# API (from root or packages/api)
npm run dev:api          # Start API with watch mode
npm run build:api        # Build API
npm run test:api         # Run API tests
npm run db:setup:local   # Initialize, migrate, and seed local DB
npm run db:migrate:local # Run migrations only

# Client (from root or packages/client)
npm run dev:client       # Start Vite dev server
npm run build:client     # Build for production
npm run test:client      # Run Vitest tests
```

## Environment Configuration

- API: `.env.local`, `.env.production` in `packages/api/`
- Client: `.env.local` in `packages/client/` (VITE_ prefix required)
