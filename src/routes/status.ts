import { FastifyPluginAsync } from "fastify"

const status: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.get('/status', async function() {
    const r = await fastify.prisma.user.count();
    return { status: 'ok', count: r };
  })
}

export default status 
