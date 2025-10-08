import { defineConfig } from 'vite'

export default defineConfig({
  // Ensure environment variables are properly loaded
  envPrefix: 'VITE_',
  
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html',
        dashboard: './dashboard.html',
        professional: './professional-dashboard.html',
        // Add other HTML files here
      }
    }
  },
  
  server: {
    port: 5173
  }
})