# Project Structure

```
img-manager/
├── packages/
│   ├── api/                    # NestJS backend
│   │   ├── src/
│   │   │   ├── auth/           # Authentication module
│   │   │   ├── collections/    # Collections CRUD + scraping
│   │   │   ├── config/         # App configuration service
│   │   │   ├── database/       # Entity definitions
│   │   │   ├── error-filters/  # Global error handling
│   │   │   ├── guards/         # Auth guards
│   │   │   ├── labels/         # Labels CRUD
│   │   │   ├── logging/        # Winston logger setup
│   │   │   ├── middlewares/    # Express middlewares
│   │   │   ├── processed-images/ # Processed images module
│   │   │   ├── scraping/       # Web scraping service
│   │   │   ├── storage/        # File storage (S3/local)
│   │   │   ├── users/          # Users CRUD
│   │   │   └── utils/          # Utility functions
│   │   ├── database/           # DB setup, migrations, seeds
│   │   │   ├── files/
│   │   │   │   ├── definitions/  # Schema SQL
│   │   │   │   ├── migrations/   # Migration SQL files
│   │   │   │   └── data/         # Seed data
│   │   │   └── services/       # DB management services
│   │   └── storage/            # Local file storage (dev)
│   │
│   └── client/                 # Vue 3 frontend
│       ├── src/
│       │   ├── api/            # HTTP client & services
│       │   ├── components/     # Vue components
│       │   ├── composables/    # Vue composables
│       │   ├── layouts/        # Page layouts
│       │   ├── plugins/        # Vue plugins (i18n, PrimeVue)
│       │   ├── router/         # Vue Router config
│       │   ├── stores/         # Pinia stores
│       │   ├── styles/         # SCSS styles
│       │   ├── types/          # TypeScript types
│       │   ├── utils/          # Utility functions
│       │   └── views/          # Page components
│       └── infrastructure/     # Client CDK stack (S3 hosting)
│
├── infrastructure/             # Main CDK infrastructure
│   ├── lib/                    # CDK stack definitions
│   └── scripts/                # EC2 init scripts
│
└── deploy/                     # Deployment scripts (CodeDeploy)
```

## Module Pattern (API)

Each feature module follows this structure:
```
module-name/
├── module-name.controller.ts   # HTTP endpoints
├── module-name.service.ts      # Business logic
├── module-name.module.ts       # NestJS module definition
├── route-tree.ts               # Route configuration
└── types.ts                    # DTOs and contracts
```

## Entity Pattern

Entities extend `BaseEntity` which provides:
- `id` (UUID, auto-generated)
- `createdOn` (timestamp)
- `modifiedOn` (timestamp, auto-updated)

## Naming Conventions

- **Files**: kebab-case (`collection.entity.ts`, `jwt-auth.guard.ts`)
- **Classes**: PascalCase (`CollectionsService`, `JwtAuthGuard`)
- **Database**: snake_case (handled by TypeORM SnakeNamingStrategy)
- **API Routes**: kebab-case, prefixed with `/api`
- **Contract classes**: Suffix with `Contract` for DTOs
