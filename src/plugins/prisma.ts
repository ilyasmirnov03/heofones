import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

// Use TypeScript module augmentation to declare the type of server.prisma to be PrismaClient
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
  }
}

const prismaPlugin: FastifyPluginAsync = fp(async (server) => {
  const pg = new PrismaPg({
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    host: process.env.POSTGRES_HOST,
    port: 5432,
  });
  const prisma = new PrismaClient({ adapter: pg });

  await prisma.$connect()

  // Make Prisma Client available through the fastify server instance: server.prisma
  server.decorate('prisma', prisma)

  server.addHook('onClose', async (server) => {
    await server.prisma.$disconnect()
  })
})

export default prismaPlugin
