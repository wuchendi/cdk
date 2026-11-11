import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routesDirectory: './src/app/routes',
      generatedRouteTree: './src/app/routeTree.gen.ts',
    }),
    tailwindcss(),
    react(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    // nsl fronts the dev server
    allowedHosts: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    // keep tests independent of a developer's local .env
    env: { VITE_API_URL: '', VITE_DASHBOARD_URL: '' },
  },
})
