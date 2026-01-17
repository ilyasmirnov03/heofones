import { FastifyPluginAsync } from "fastify"

const status: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.get('/status', async function() {
    const client = await fastify.pg.connect();
    const { rows } = await client.query('SELECT NOW()');
    client.release();
    return { status: 'ok', time: rows[0].now }
  })
}

export default status 
