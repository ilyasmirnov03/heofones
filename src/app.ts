import { join } from 'node:path'
import AutoLoad, { AutoloadPluginOptions } from '@fastify/autoload'
import { FastifyPluginAsync, FastifyServerOptions } from 'fastify'
import { GLOBAL_PREFIX } from './constant/global-prefix'
import fastifyPostgres from '@fastify/postgres'
import 'dotenv/config';

export interface AppOptions extends FastifyServerOptions, Partial<AutoloadPluginOptions> {

}
// Pass --options via CLI arguments in command to enable these options.
const options: AppOptions = {
}

const app: FastifyPluginAsync<AppOptions> = async (
  fastify,
  opts
): Promise<void> => {
  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  // eslint-disable-next-line no-void
  void fastify.register(AutoLoad, {
    dir: join(__dirname, 'plugins'),
    options: opts
  })

  // This loads all plugins defined in routes
  // define your routes in one of these
  // eslint-disable-next-line no-void
  void fastify.register(AutoLoad, {
    dir: join(__dirname, 'routes'),
    options: {
      ...opts,
      prefix: GLOBAL_PREFIX,
    }
  })

  fastify.register(fastifyPostgres, {
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    port: 5432,
  });
}

export default app
export { app, options }
