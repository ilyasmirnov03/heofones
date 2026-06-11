# Heofones — Architecture Overview

## Design Principles

- **Turn-based, API-first**: Players submit actions via HTTP; the server processes them in turn cycles.
- **Distributed-ready**: Architecture supports multiple game-server instances communicating via a message queue.
- **Lazy world generation**: Worlds are generated on-demand using deterministic seeds. Cells are generated when first accessed and cached.
- **Configuration-driven**: Game rules, world size, and generation parameters come from a config file at startup.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Clients (HTTP)                     │
└───────────────────────┬─────────────────────────────────┘
                        │
              ┌─────────▼──────────┐
              │   Fastify API      │
              │   (auth, routes)   │
              └─────────┬──────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐
│ World Module │ │ Turn Engine│ │ Unit Module│
│ (generation, │ │ (processing│ │ (actions,  │
│  cells, feat.)│ │  queue)    │ │  movement) │
└──────────────┘ └────────────┘ └────────────┘
        │               │               │
        └───────────────┼───────────────┘
                        │
              ┌─────────▼──────────┐
              │   Prisma / PG      │
              │   (persistent)     │
              └────────────────────┘
```

## Core Concepts

### World Instance
Each world is an independent game instance with its own seed, size, and state. Worlds are created from templates/configs.

### Cell (Grid)
A cell is a single grid position `(x, y)` within a world. Cells are lazily generated from the world's seed using a deterministic algorithm. Each cell can contain multiple features (terrain, resources, hazards).

### Turn
A turn is a batch of all player actions submitted during a time window. The Turn Engine processes them in order, updating the world state.

### Unit
A unit is a player-controlled entity that occupies a cell. Units can move, gather, build, and explore. Units can be lost to environmental hazards.

### Resources
- **Food**: Consumed by units. Low food reduces gathering efficiency.
- **Heofym**: Magical crystal, depletes when mined, regenerates over time.

## Risk / Challenge System (No Combat)

Since there's no combat, challenges come from the environment:

| Hazard | Mechanic |
|--------|----------|
| **Terrain danger** | Each terrain type has a danger level. Units have a chance to be injured/killed when acting in dangerous terrain. |
| **Food scarcity** | If a world's food supply drops below a threshold, units in that world suffer attrition (random unit loss). |
| **World decay** | Over time, cells can degrade. Features may disappear; new hazards may appear. |
| **Feature competition** | Multiple players' units on the same cell compete for features (first-to-act advantage, or shared reduced yields). |
| **Exhaustion** | Units have stamina. Overuse without rest reduces effectiveness or causes collapse. |

## Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Fastify 5 + TypeScript |
| ORM | Prisma 6+ + PostgreSQL |
| Validation | TypeBox |
| Auth | JWT (`@fastify/jwt`) |
| Config | JSON/YAML config file + env vars |
| Cache (future) | Redis for turn state |
| Queue (future) | SQS-compatible for distributed processing |

## Directory Structure

```
heofones/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # Prisma migrations
├── src/
│   ├── app.ts                 # Fastify app entry
│   ├── config/                # Game configuration
│   │   ├── game.config.json   # Runtime config
│   │   └── world.config.json  # World generation templates
│   ├── constant/
│   │   └── global-prefix.ts
│   ├── modules/               # Domain modules
│   │   ├── auth/
│   │   ├── world/
│   │   ├── cell/
│   │   ├── unit/
│   │   ├── resource/
│   │   ├── turn/
│   │   └── generation/
│   ├── plugins/
│   │   ├── prisma.ts
│   │   └── sensible.ts
│   └── routes/
│       ├── register.ts
│       ├── status.ts
│       └── ...
├── test/
│   ├── helper.ts
│   └── routes/
├── planning/
│   ├── dev-plan.md            # This plan
│   └── ARCHITECTURE.md        # This file
└── package.json
```
