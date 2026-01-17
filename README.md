# Heofones

A multiplayer RPG played through an open API.

## Technical overview

Heofones API is built with fastify framework and TypeScript. It uses the PostgreSQL database and integrates Prisma ORM.
Local development environment is available in docker-compose.yml under the `local` profile.

## Start development

You have to generate a Prisma client before you can start developing:

```shell
npm run prisma:generate
```

In the project directory, you can run:

### `npm run dev`

To start the app in dev mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### `npm start`

For production mode

### `npm run test`

Run the test cases.

