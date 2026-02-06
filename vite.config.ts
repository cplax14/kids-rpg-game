import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    // Disable sourcemaps in production (smaller bundle, no code inspection)
    sourcemap: false,
    // Optimize chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          // Phaser is large (~1MB) - separate chunk for better caching
          phaser: ['phaser'],
        },
      },
    },
  },
  // Exclude downloads folder from build (raw source assets)
  publicDir: 'public',
})
