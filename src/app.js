import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSite, renderPage } from './render.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const isProd = process.env.NODE_ENV === 'production';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind Caddy in production

  // In production the page is rendered once; in dev every request re-reads
  // eras.json and the template so content edits show up without a restart.
  let cached;
  const homePage = async () => {
    if (isProd && cached) return cached;
    const html = await renderPage(await loadSite());
    if (isProd) cached = html;
    return html;
  };
  if (isProd) homePage().catch((err) => { console.error(err); process.exit(1); });

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.get('/', async (_req, res, next) => {
    try {
      res.type('html').set('Cache-Control', 'no-cache').send(await homePage());
    } catch (err) {
      next(err);
    }
  });

  app.use(express.static(publicDir, { extensions: ['html'], maxAge: isProd ? '10m' : 0 }));

  app.use((_req, res) => {
    res.status(404).sendFile(path.join(publicDir, '404.html'));
  });

  return app;
}
