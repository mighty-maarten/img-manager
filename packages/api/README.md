# IMG Manager API

## Description

IMG Manager API, made using the [Nest](https://github.com/nestjs/nest) TypeScript framework.

## Installation

```bash
$ npm install
```

## Local Development

### Environment variables

The project is setup to use NestJS' builtin config module. For local development this requires a `.env.local` file to be present at the root of the repository.

The included `.env.example` file is a good starting point, and will work to connect to the local database if you start it using the docker-compose.yml. Copy it's contents to a `.env.local` file to get started.

### Local database

For local development, make sure to have a local postgres instance running

To setup the database, run:

```bash
$ npm run db:setup:local
```

To run migrations, run:

```bash
$ npm run db:migrate:local
```

## Running the app

```bash
# development with watch mode
$ npm run start:local
```

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```
