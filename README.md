# Vehicle catalog service

Pulls vehicle makes and their vehicle types from the
[NHTSA vPIC API](https://vpic.nhtsa.dot.gov/api/) (XML), combines them into one
JSON structure, stores it in PostgreSQL and serves it through one GraphQL
endpoint.

```json
[{ "makeId": 440, "makeName": "ASTON MARTIN",
   "vehicleTypes": [{ "typeId": 2, "typeName": "Passenger Car" }] }]
```

Built with NestJS, TypeScript, GraphQL (Apollo), PostgreSQL + TypeORM, Zod and
Pino. How it works inside: [docs/design.md](docs/design.md).

## Run it

```bash
docker compose up --build
```

Open http://localhost:3000/graphql. On first start the API ingests 50 makes from
NHTSA (about 10 seconds). For the whole catalog (~40 minutes), run it with
`INGEST_MAKES_LIMIT=0`.

## Develop

Requires Node 22, pnpm 10 and Docker.

```bash
pnpm install
cp .env.example .env       # real NHTSA API, 50 makes
docker compose up -d db
pnpm start:dev             # API on :3000
pnpm ingest:dev            # one ingestion run
```

| Command | |
| --- | --- |
| `pnpm test` | Unit tests |
| `pnpm test:integration` | Integration and end-to-end tests (uses Docker) |
| `pnpm lint` / `pnpm typecheck` | Static checks |
| `pnpm migration:run` | Apply migrations (after `pnpm build`) |

## Build

```bash
pnpm build                 # compiles to dist/
pnpm start:prod            # runs the API
pnpm ingest                # runs one ingestion and exits (for a scheduler)
docker build -t vehicle-catalog .
```

## Configuration

Environment variables, validated at startup. The service won't start if one is
invalid.

| Variable | Default | |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `test` or `production` |
| `PORT` | `3000` | |
| `LOG_LEVEL` | `info` | |
| `DB_HOST` / `DB_PORT` | `localhost` / `5432` | |
| `DB_USER` / `DB_NAME` | `postgres` / `vehicles` | |
| `DB_PASSWORD` | **required** | |
| `DB_RUN_MIGRATIONS` | `true` | Apply migrations on startup |
| `NHTSA_BASE_URL` | NHTSA's URL | Real API: `https://vpic.nhtsa.dot.gov/api/vehicles`. Local mock: `http://localhost:8080/api/vehicles` (`http://nhtsa-mock:8080/api/vehicles` inside Docker Compose) |
| `NHTSA_REQUESTS_PER_SECOND` | `5` | Rate limit; the default 5 is safe for the real API |
| `NHTSA_CONCURRENCY` | `10` | Requests in flight |
| `NHTSA_TIMEOUT_MS` | `10000` | Per request |
| `NHTSA_MAX_RETRIES` | `3` | For network errors, 429 and 5xx |
| `NHTSA_RETRY_BASE_DELAY_MS` | `500` | Backoff base |
| `INGEST_ON_STARTUP` | `false` | Ingest when the API starts with an empty catalog |
| `INGEST_MAKES_LIMIT` | — | Only ingest N makes; `0` means all. Docker Compose and `.env.example` use 50 |
| `INGEST_BATCH_SIZE` | `500` | Makes per batch |

## Data model

```mermaid
erDiagram
  makes ||--o{ make_vehicle_types : builds
  vehicle_types ||--o{ make_vehicle_types : "built by"
  makes {
    integer make_id PK
    text make_name
  }
  vehicle_types {
    integer type_id PK
    text type_name
  }
  make_vehicle_types {
    integer make_id FK
    integer type_id FK
  }
```

Vehicle types are stored once and linked to makes, since thousands of makes
share them. `ingestion_runs` records each ingestion: status, counts and the
makes that failed.

## GraphQL

The documented schema is in [schema.gql](schema.gql).

| Query | |
| --- | --- |
| `makes(first, after, name, vehicleTypeId)` | Makes by name, paginated with cursors, optionally filtered |
| `make(makeId)` | One make, or `null` |
| `vehicleTypes` | All vehicle types |
| `lastIngestion` | Latest ingestion run and its progress |

```graphql
{
  makes(first: 3, name: "honda") {
    totalCount
    nodes { makeId makeName vehicleTypes { typeName } }
    pageInfo { hasNextPage endCursor }
  }
}
```

Next page: pass `endCursor` as `after`.

```graphql
{
  make(makeId: 440) { makeName vehicleTypes { typeName } }
  lastIngestion { status makesSaved makesFailed }
}
```
