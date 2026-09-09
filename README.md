# grantlindburg.com

Portfolio site for grantlindburg.com. One long-scroll page, "Strata": each career era is rendered in the visual dialect of that period. Express serves it; there is no build step.

## Editing content

Everything on the page comes from `public/data/eras.json`. Edit that file and reload; in development the server re-reads it on every request.

- `person` — name, tagline, job title, email, profile links (hero and footer).
- `meta` — page title and description (also used for Open Graph).
- `eras[]` — one entry per section, newest first. Each has `id`, `dialect` (`ai`, `webgl`, `editorial`, or `terminal`), `years`, `title`, `role`, `org`, `summary`, `projects[]`, and `lesson`.
- `projects[]` — `title`, `role`, `stack[]`, `outcome`, optional `href`. Set `"placeholder": true` on an era or a project to show a "sample" badge until real content lands.
- `extras` — dialect-specific: `ai.log[]` (the trace lines beside the diagram), `webgl.site` / `webgl.instagram` (stage links), `terminal.prompt`.

The server validates the file on startup in production and fails fast if a required field is missing. `npm test` runs the same validation.

## How it is put together

- `src/render.js` turns `eras.json` into HTML using the slot template in `src/views/index.html`. The page is real HTML with JavaScript off.
- `public/styles/base.css` holds tokens and the shared skeleton; each `public/styles/era-*.css` overrides tokens under `[data-dialect="…"]`.
- `public/js/main.js` adds the scroll-aware bits: the active era in the rail, the one-time editorial reveal, and lazy-loading the Three.js scene (`public/js/era-webgl.js`) from a pinned CDN only when that section is near the viewport.
- Reduced motion is respected globally; every era reads as finished without animation.

## Local development

```sh
npm install
npm run dev        # http://localhost:3000, restarts on file changes
npm test
```

Run the production stack locally with Docker (HTTP only, no TLS):

```sh
docker compose up --build app
```

## Deploying to a DigitalOcean droplet

1. Create an Ubuntu 24.04 droplet (the smallest size is fine) with your SSH key.
2. In your DNS provider, point `A` records for `grantlindburg.com` and `www.grantlindburg.com` at the droplet's IP.
3. Push this repo to GitHub (or any git host the droplet can reach).
4. On the droplet, run the one-time setup:

   ```sh
   ssh root@<droplet-ip>
   curl -fsSL https://raw.githubusercontent.com/<you>/grantlindburg/main/deploy/droplet-setup.sh -o setup.sh
   bash setup.sh https://github.com/<you>/grantlindburg.git
   ```

   This installs Docker, opens ports 22/80/443 in the firewall, clones the repo to `/opt/grantlindburg`, and starts the app behind Caddy. Caddy fetches a Let's Encrypt certificate automatically once DNS resolves to the droplet.

5. For later releases, push to `main` and run from your machine:

   ```sh
   ./deploy/deploy.sh root@<droplet-ip>
   ```

Health check: `https://grantlindburg.com/healthz`.
