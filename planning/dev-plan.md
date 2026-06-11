# Heofones — Development Plan (1-Month MVP)

> **Goal**: A playable MVP where players can register, create/join a world, explore a procedurally generated grid, move units, gather resources (Food, Heofym), and build structures — all via REST API.

---

## Phase 1 — Foundation (Days 1-3)

**Goal**: Set up the core infrastructure — config system, database schema, and the world/cell data model.

### Tasks

#### 1.1 Config System
- Create `src/config/game.config.ts` — TypeScript config loader that reads from `config/game.config.json`.
- Define the config interface:
  ```ts
  interface GameConfig {
    world: {
      defaultSize: number;        // e.g., 100
      minSize: number;
      maxSize: number;
      seed: string;               // default world seed
    };
    turn: {
      durationSeconds: number;     // turn window length
      maxActionsPerPlayer: number;
    };
    resources: {
      foodBaseYield: number;
      heofymBaseYield: number;
      foodDecayThreshold: number; // food level below which attrition starts
    };
    unit: {
      maxUnitsPerPlayer: number;
      moveRangePerTurn: number;
      staminaMax: number;
      staminaRegenPerTurn: number;
    };
    generation: {
      terrainTypes: TerrainConfig[];
      featureTypes: FeatureConfig[];
      dangerLevels: Record<string, number>;
    };
  }
  ```
- Create `config/game.config.json` with sensible defaults.
- Export a singleton `getGameConfig()` function.

#### 1.2 Database Schema (Prisma)
- Update `prisma/schema.prisma` with the following models:

```prisma
model User {
  id       Int      @id @default(autoincrement())
  name     String   @unique
  jwtSecret String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  worlds   WorldPlayer[]
  units    Unit[]
}

model World {
  id        Int        @id @default(autoincrement())
  name      String
  seed      String     @unique
  size      Int
  status    WorldStatus @default(ACTIVE)
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
  players   WorldPlayer[]
  cells     Cell[]
  resources WorldResources
}

enum WorldStatus {
  ACTIVE
  ARCHIVED
  DELETING
}

model WorldPlayer {
  id        Int      @id @default(autoincrement())
  role      WorldRole @default(MEMBER)
  userId    Int
  user      User     @relation(fields: [userId], references: [id])
  worldId   Int
  world     World    @relation(fields: [worldId], references: [id])
  createdAt DateTime @default(now())

  @@unique([userId, worldId])
}

enum WorldRole {
  OWNER
  ADMIN
  MEMBER
}

model Cell {
  id         Int         @id @default(autoincrement())
  worldId    Int
  world      World       @relation(fields: [worldId], references: [id])
  x          Int
  y          Int
  generated  Boolean     @default(false)
  terrain    String?
  features   Json?       // { type: string, level: number, depleted: boolean, ... }[]
  units      CellUnit[]
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt

  @@unique([worldId, x, y])
}

model CellUnit {
  id       Int      @id @default(autoincrement())
  cellId   Int
  cell     Cell     @relation(fields: [cellId], references: [id])
  unitId   Int
  unit     Unit     @relation(fields: [unitId], references: [id])
  arrivedAt DateTime @default(now())

  @@unique([cellId, unitId])
}

model Unit {
  id          Int        @id @default(autoincrement())
  name        String
  ownerId     Int
  owner       User       @relation(fields: [ownerId], references: [id])
  worldId     Int
  world       World      @relation(fields: [worldId], references: [id])
  hp          Int        @default(100)
  maxHp       Int        @default(100)
  stamina     Int        @default(100)
  maxStamina  Int        @default(100)
  alive       Boolean    @default(true)
  lastMoveAt  DateTime?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@index([ownerId])
  @@index([worldId])
}

model WorldResources {
  id              Int    @id @default(autoincrement())
  worldId         Int    @unique
  world           World  @relation(fields: [worldId], references: [id])
  food            Int    @default(1000)
  heofym          Int    @default(500)
  lastRegenAt     DateTime @default(now())
}

model Turn {
  id          Int        @id @default(autoincrement())
  worldId     Int
  world       World      @relation(fields: [worldId], references: [id])
  number      Int
  status      TurnStatus @default(PENDING)
  startedAt   DateTime?
  finishedAt  DateTime?
  createdAt   DateTime   @default(now())

  @@index([worldId, number])
}

enum TurnStatus {
  PENDING
  PROCESSING
  COMPLETED
}

model Action {
  id          Int        @id @default(autoincrement())
  turnId      Int
  turn        Turn       @relation(fields: [turnId], references: [id])
  userId      Int
  unitId      Int
  type        ActionType
  targetX     Int?
  targetY     Int?
  payload     Json?
  result      Json?
  createdAt   DateTime   @default(now())

  @@index([turnId])
  @@index([userId])
}

enum ActionType {
  MOVE
  GATHER_FOOD
  GATHER_HEOFYM
  BUILD
  REST
  EXPLORE
}
```

#### 1.3 Prisma Migration
- Run `npx prisma migrate dev --name init` to create the initial migration.
- Regenerate client: `npm run prisma:generate`.

### Deliverables
- [ ] `src/config/game.config.ts` with config loader
- [ ] `config/game.config.json` with defaults
- [ ] Updated Prisma schema with all models
- [ ] Migration applied and client regenerated

---

## Phase 2 — World & Generation (Days 4-8)

**Goal**: Procedural world generation with lazy cell creation.

### Tasks

#### 2.1 Terrain & Feature Definitions
- Define terrain types in config: `plains`, `forest`, `mountain`, `swamp`, `desert`, `river`, `crystal_cave`.
- Define feature types per terrain:
  - `plains`: berry_bush (food source), open_land
  - `forest`: berry_bush, timber, crystal_vein (low yield)
  - `mountain`: crystal_cave (high yield), rocky_terrain (dangerous)
  - `swamp`: marsh_plants (food), toxic_puddle (danger)
  - `desert`: oasis (food), sand_dune
  - `river`: water_source (food), fishing_spot
  - `crystal_cave`: heofym_deposit (high yield), crystal_formation

#### 2.2 Generation Engine (`src/modules/generation/`)
- Create `CellGenerator` class:
  - `generateCell(worldSeed: string, x: number, y: number): CellData`
  - Uses deterministic seed-based random (e.g., mulberry32 or similar PRNG seeded from `worldSeed + x + y`).
  - Returns: terrain type, features array, danger level.
- Create `WorldGenerator` class:
  - `generateWorld(config: GameConfig): WorldData` — generates initial metadata (seed, size, resource totals).
  - `getOrCreateCell(worldId, x, y): Promise<Cell>` — lazy generation: checks DB first, generates if not found.
- Create `FeatureGenerator` helper:
  - Determines which features appear on a terrain based on config probabilities.
  - Sets initial depletion state and regeneration timers.

#### 2.3 World Creation Route
- `POST /v1/worlds` — Create a new world instance.
  - Body: `{ name: string, size?: number, seed?: string }`
  - If no seed provided, generate one from game config.
  - Creates `World`, `WorldResources`, and `WorldPlayer` (owner).
  - Returns world details.
- `GET /v1/worlds/:id` — Get world state (for exploration preview).
  - Returns world info + generated cells the player has discovered.
- `GET /v1/worlds` — List worlds the player is in.

#### 2.4 Cell Exploration Route
- `GET /v1/worlds/:worldId/cells/:x/:y` — Get cell data (requires player to be in the world).
  - If cell not generated yet, generates it lazily.
  - Returns terrain, features, danger level, units present.
- `POST /v1/worlds/:worldId/cells/explore` — Explore a cell (requires a unit nearby).
  - Marks cell as discovered for the player.
  - Reveals features.

### Deliverables
- [ ] `src/modules/generation/cell.generator.ts`
- [ ] `src/modules/generation/world.generator.ts`
- [ ] `src/modules/generation/feature.generator.ts`
- [ ] `POST /v1/worlds` route
- [ ] `GET /v1/worlds/:id` route
- [ ] `GET /v1/worlds/:worldId/cells/:x/:y` route
- [ ] `POST /v1/worlds/:worldId/cells/explore` route
- [ ] Tests for generation logic (deterministic output)

---

## Phase 3 — Units & Movement (Days 9-14)

**Goal**: Create units, move them across the grid, and handle cell occupancy.

### Tasks

#### 3.1 Unit Management
- `POST /v1/worlds/:worldId/units` — Create a new unit.
  - Body: `{ name: string }`
  - Spawns unit at a random starting cell (or a designated spawn point).
  - Costs resources to create (configurable).
- `GET /v1/units` — List player's units (with world filter).
- `GET /v1/units/:id` — Get unit details (HP, stamina, current cell).
- `DELETE /v1/units/:id` — Disband a unit (if alive).

#### 3.2 Movement System
- `POST /v1/units/:id/move` — Move a unit to an adjacent cell.
  - Body: `{ x: number, y: number }`
  - Validates: target is adjacent, target cell is within world bounds, unit has stamina.
  - Checks terrain danger: on arrival, rolls danger check. Failure = HP loss.
  - Updates `CellUnit` record and unit's `lastMoveAt`.
  - Costs stamina (base cost + terrain modifier).

#### 3.3 Rest Mechanic
- `POST /v1/units/:id/rest` — Unit rests, regaining stamina.
  - Body: `{ turns: number }` (how many turns to rest)
  - Regains `staminaRegenPerTurn * turns` stamina.
  - Unit cannot act while resting.

#### 3.4 Cell Occupancy
- Track which units are on which cells via `CellUnit` model.
- `GET /v1/worlds/:worldId/cells/:x/:y?units=true` — Include units in cell response.
- Handle multiple units on same cell (competition for features).

### Deliverables
- [ ] `src/modules/unit/` module
- [ ] `POST /v1/worlds/:worldId/units` route
- [ ] `GET /v1/units` + `GET /v1/units/:id` routes
- [ ] `POST /v1/units/:id/move` route
- [ ] `POST /v1/units/:id/rest` route
- [ ] `CellUnit` tracking
- [ ] Danger check on terrain entry
- [ ] Tests for movement validation

---

## Phase 4 — Resources & Gathering (Days 15-21)

**Goal**: Resource gathering, food management, Heofym mining, and building construction.

### Tasks

#### 4.1 Gathering
- `POST /v1/units/:id/gather` — Gather resources from current cell's features.
  - Body: `{ resourceType: 'food' | 'heofym' }`
  - Validates: unit is on a cell with matching feature.
  - Calculates yield:
    ```
    baseYield = config.resources.<resource>BaseYield
    foodMultiplier = clamp(worldResources.food / 1000, 0.3, 1.0)
    staminaCost = 10
    if (unit.stamina < staminaCost) return { error: 'Not enough stamina' }
    yield = baseYield * foodMultiplier
    ```
  - For Heofym: check if feature is depleted. If not, deplete it by a small amount.
    - Track depletion: `feature.depleted += 1`. When `depleted >= feature.maxDepletion`, feature is exhausted.
    - Regeneration: feature regenerates after `regenDays` turns (stored as timestamp).
  - Updates `WorldResources.food` or `WorldResources.heofym`.
  - Deducts stamina.
  - Returns yield amount.

#### 4.2 World Resource Management
- `GET /v1/worlds/:worldId/resources` — Get world resource totals.
- Heofym regeneration logic:
  - On turn processing, check `WorldResources.lastRegenAt`.
  - If enough time passed, regenerate depleted features in discovered cells.
  - Increment `WorldResources.heofym` for regenerated features.

#### 4.3 Building System
- `POST /v1/units/:id/build` — Build a structure on the current cell.
  - Body: `{ type: 'granary' | 'crystal_extractor' | 'shelter' }`
  - Granary: Increases world food capacity (+500 food storage).
  - Crystal Extractor: Increases Heofym gathering yield by 25% per building.
  - Shelter: Reduces terrain danger by 20% for units on that cell.
  - Costs Heofym to build (configurable per building type).
  - Buildings are persistent on the cell.

#### 4.4 Food Consumption
- Each turn, calculate food consumption:
  ```
  consumption = unitsInWorld.length * foodPerUnitPerTurn
  worldResources.food -= consumption
  if (worldResources.food < 0) {
    worldResources.food = 0
    triggerFoodCrisis()
  }
  ```
- Food crisis: when food = 0, apply attrition (random unit HP loss, then death if HP <= 0).

### Deliverables
- [ ] `src/modules/resource/` module
- [ ] `POST /v1/units/:id/gather` route
- [ ] `GET /v1/worlds/:worldId/resources` route
- [ ] `POST /v1/units/:id/build` route
- [ ] Heofym depletion + regeneration logic
- [ ] Food consumption + crisis system
- [ ] Tests for gathering calculations

---

## Phase 5 — Turn Engine (Days 22-25)

**Goal**: The core turn processing system that batches and executes player actions.

### Tasks

#### 5.1 Turn Lifecycle
- `POST /v1/worlds/:worldId/turns/submit` — Submit actions for the current turn.
  - Body: `{ actions: ActionSubmission[] }`
  - `ActionSubmission = { unitId: number, type: ActionType, payload: Json }`
  - Validates all actions (permissions, stamina, position, etc.).
  - Creates a new `Turn` record (status: PENDING).
  - Creates `Action` records for each submitted action.
  - Triggers turn processing (async).

- `GET /v1/worlds/:worldId/turns` — List recent turns.
- `GET /v1/worlds/:worldId/turns/:turnId` — Get turn details + action results.

#### 5.2 Turn Processing Engine
- Create `src/modules/turn/turn-processor.ts`:
  - **Phase 1 — Validate**: Check all actions are legal (stamina, position, permissions).
  - **Phase 2 — Execute**: Process actions in order:
    1. Rest actions (regain stamina).
    2. Move actions (update positions, check danger).
    3. Gather actions (calculate yields, update resources).
    4. Build actions (create structures).
  - **Phase 3 — Resolve**: Apply world-level effects:
    - Food consumption.
    - Feature regeneration.
    - Unit HP/stamina updates.
    - Death resolution.
  - **Phase 4 — Finalize**: Update `Turn.status = COMPLETED`, write results.

#### 5.3 Action Results
- Each action returns a result in the `Action.result` JSON field:
  ```json
  {
    "type": "MOVE",
    "success": true,
    "data": {
      "from": { x: 10, y: 10 },
      "to": { x: 10, y: 11 },
      "hpLost": 5,
      "staminaCost": 15
    }
  }
  ```

#### 5.4 Turn Scheduling
- Simple in-memory scheduler for MVP:
  - When the first player submits actions, start a timer for `turn.durationSeconds`.
  - After the timer, process the turn.
  - Allow a grace period for late submissions.
- For distributed readiness: use a simple polling mechanism (check turn status periodically).

### Deliverables
- [ ] `src/modules/turn/turn-engine.ts`
- [ ] `src/modules/turn/turn-processor.ts`
- [ ] `POST /v1/worlds/:worldId/turns/submit` route
- [ ] `GET /v1/worlds/:worldId/turns` routes
- [ ] Action validation + execution pipeline
- [ ] Turn result reporting
- [ ] Tests for turn processing

---

## Phase 6 — Polish & Integration (Days 26-30)

**Goal**: Tie everything together, add error handling, documentation, and tests.

### Tasks

#### 6.1 Authentication Endpoints
- `POST /v1/auth/login` — Login with name (JWT issued).
  - Body: `{ name: string }`
  - If user doesn't exist, creates one (auto-register).
  - Returns JWT token.
- `GET /v1/auth/me` — Get current user info (requires auth).

#### 6.2 Error Handling
- Standardize error responses using `@fastify/sensible`:
  ```json
  {
    "statusCode": 400,
    "error": "Bad Request",
    "message": "Unit is not on the target cell"
  }
  ```
- Create custom error types for game-specific errors:
  - `InsufficientStaminaError`
  - `UnitNotInWorldError`
  - `CellOutOfBoundsError`
  - `FeatureDepletedError`
  - `InsufficientResourcesError`

#### 6.3 World State Query
- `GET /v1/worlds/:worldId/state` — Full world state snapshot.
  - Returns: world info, resources, discovered cells, player units, buildings.
  - Used by clients to render the game state.

#### 6.4 Tests
- Write integration tests for:
  - World creation + player joining
  - Unit creation + movement
  - Resource gathering (with food multiplier)
  - Heofym depletion + regeneration
  - Building construction
  - Turn submission + processing
  - Food crisis + attrition
- Add test helper utilities for creating test worlds and units.

#### 6.5 Documentation
- Update `README.md` with:
  - API endpoint reference
  - Game mechanics overview
  - Config file explanation
  - Quick start guide
- Add JSDoc comments to key modules.

#### 6.6 Config Validation
- Add runtime validation of `game.config.json` using TypeBox.
- Fail fast on invalid config at startup.

### Deliverables
- [ ] `POST /v1/auth/login` route
- [ ] `GET /v1/auth/me` route
- [ ] `GET /v1/worlds/:worldId/state` route
- [ ] Standardized error handling
- [ ] Integration test suite
- [ ] Updated README
- [ ] Config validation

---

## API Endpoint Reference (MVP)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/v1/auth/login` | No | Login / auto-register, returns JWT |
| GET | `/v1/auth/me` | Yes | Current user info |
| POST | `/v1/worlds` | Yes | Create a new world |
| GET | `/v1/worlds` | Yes | List worlds player is in |
| GET | `/v1/worlds/:id` | Yes | Get world details |
| GET | `/v1/worlds/:id/state` | Yes | Full world state snapshot |
| GET | `/v1/worlds/:id/resources` | Yes | World resource totals |
| GET | `/v1/worlds/:id/cells/:x/:y` | Yes | Get cell data (lazy gen) |
| POST | `/v1/worlds/:id/cells/explore` | Yes | Explore a cell |
| POST | `/v1/worlds/:id/units` | Yes | Create a unit |
| GET | `/v1/units` | Yes | List player units |
| GET | `/v1/units/:id` | Yes | Get unit details |
| DELETE | `/v1/units/:id` | Yes | Disband a unit |
| POST | `/v1/units/:id/move` | Yes | Move unit (adjacent cell) |
| POST | `/v1/units/:id/rest` | Yes | Unit rests (regain stamina) |
| POST | `/v1/units/:id/gather` | Yes | Gather resource from cell |
| POST | `/v1/units/:id/build` | Yes | Build structure on cell |
| POST | `/v1/worlds/:id/turns/submit` | Yes | Submit actions for turn |
| GET | `/v1/worlds/:id/turns` | Yes | List recent turns |
| GET | `/v1/worlds/:id/turns/:turnId` | Yes | Get turn results |

---

## Module Dependency Graph

```
auth
  └── user model

world
  ├── world model
  ├── cell model
  ├── world player model
  └── generation module
        ├── config
        └── feature definitions

unit
  ├── unit model
  ├── cell model (CellUnit)
  └── movement validation

resource
  ├── resource model
  ├── cell model (features)
  └── unit model (stamina)

turn
  ├── turn model
  ├── action model
  ├── unit module (validation)
  ├── resource module (effects)
  └── world module (effects)
```

---

## Key Design Decisions

1. **Lazy cell generation**: Cells are generated when first accessed, not all at once. This keeps the initial DB footprint small and allows large worlds.

2. **Deterministic generation**: Same seed + coordinates always produces the same cell. This allows regeneration if data is lost and enables replay/debugging.

3. **Turn-based processing**: All actions are submitted in a batch and processed together. This simplifies concurrency and makes the game feel strategic.

4. **World resources are global**: Food and Heofym totals are per-world, not per-cell. This creates shared resource management as a gameplay mechanic.

5. **Config-driven gameplay**: All game rules (yields, costs, dangers) come from config files, not hardcoded. This makes balancing easy and enables modding.
