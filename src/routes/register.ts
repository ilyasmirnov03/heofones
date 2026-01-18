import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import Type from "typebox";


const register: FastifyPluginAsyncTypebox = async (fastify, opts): Promise<void> => {
  fastify.post('/register', {
    schema: {
      body: Type.Object({
        name: Type.String({ minLength: 4, maxLength: 16, }),
      })
    },
  }, async (request, reply) => {
    const user = await fastify.prisma.user.create({
      data: request.body,
    });
    reply.send(user);
  });
}

export default register
