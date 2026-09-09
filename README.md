# grantlindburg.com

Small Express server for grantlindburg.com. Static files live in `public/`, routes in `src/app.js`.

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
