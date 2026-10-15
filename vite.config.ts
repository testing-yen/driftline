import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  // DEV_TUNNEL_HOST (e.g. in .env.local) is your named Cloudflare Tunnel
  // hostname. Vite rejects requests whose Host header it doesn't recognise,
  // so tunnel hostnames must be allow-listed for iPhone testing over HTTPS.
  const { DEV_TUNNEL_HOST } = loadEnv(mode, '.', '');

  return {
    server: {
      allowedHosts: ['.trycloudflare.com', ...(DEV_TUNNEL_HOST ? [DEV_TUNNEL_HOST] : [])],
    },
    build: {
      outDir: 'dist',
    },
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts'],
    },
  };
});
