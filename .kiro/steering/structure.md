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
│   │   │   ├── guards/         # Auth guards
│   │   │   ├── labels/         # Labels module
│   │   │   ├── processed-images/ # Processed images module
│   │   │   ├── scraping/       # Web scraping service
│   │   │   ├── storage/        # File storage abstraction
│   │   │   ├── users/          # Users module
│   │   │   ├── app.module.ts   # Root module
│   │   │   ├── main.ts         # Bootstrap
│   │   │   └── routes.ts       # Route tree definitions
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
│       │   ├── api/            # HTTP client + service classes
│       │   ├── components/     # Reusable Vue components
│       │   ├── composables/    # Vue composables
│       │   ├── layouts/        # Page layouts
│       │   ├── plugins/        # Vue plugins (i18n, primevue)
│       │   ├── router/         # Vue Router config
│       │   ├── stores/         # Pinia stores
│       │   ├── styles/         # Global SCSS
│       │   ├── views/          # Page components
│       │   └── main.ts         # App entry
│       └── infrastructure/     # Client CDK stack (S3 hosting)
│
├── infrastructure/             # Main CDK infrastructure
│   ├── lib/                    # CDK stack definitions
│   └── scripts/                # Deployment scripts
│
└── deploy/                     # CodeDeploy scripts
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

- All entities extend `BaseEntity` (id, createdOn, lastUpdatedOn)
- Located in `packages/api/src/database/entities/`
- Use TypeORM decorators with snake_case naming strategy

## Store Pattern (Client)

Pinia stores use Composition API style with:
- `useStoreCreationUtils` for consistent loading/error state
- Async actions wrapped in `handleAction` for error handling
- Reactive refs for state
