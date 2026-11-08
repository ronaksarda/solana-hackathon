import { defineConfig, loadEnv } from 'vite';

// Serves api/*.js locally the same way Vercel does, so no Vercel CLI is needed for dev.
function localApi() {
  return {
    name: 'local-api',
    configureServer(server) {
      Object.assign(process.env, loadEnv('development', process.cwd(), ''));
      server.middlewares.use('/api', async (req, res) => {
        const name = req.url.split('?')[0].replace(/^\//, '');
        try {
          const mod = await server.ssrLoadModule(`/api/${name}.js`);
          let raw = '';
          for await (const chunk of req) raw += chunk;
          req.body = raw ? JSON.parse(raw) : {};
          await mod.default(req, res);
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    },
  };
}

export default defineConfig({ plugins: [localApi()] });
