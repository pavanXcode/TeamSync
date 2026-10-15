import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    host: true,
    watch: {
      ignored: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.git/**',
        '**/Frontend CrewIQ/**',
        '**/SETUP/**',
        '**/Bandicam/**',
        '**/Bandicut/**',
        '**/bgmi/**',
        '**/classs work/**',
        '**/Custom Office Templates/**',
        '**/Desktop/**',
        '**/Downloads/**',
        '**/FlashIntegro/**',
        '**/GTA*/**',
        '**/MuMu*/**',
        '**/My*/**',
        '**/NFS*/**',
        '**/OpenIV/**',
        '**/packs/**',
        '**/Rainmeter/**',
        '**/Rockstar Games/**',
        '**/TM TT*/**',
        '**/Visual Studio*/**',
        '**/XuanZhi*/**',
        '**/Zoom/**',
      ],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          icons: ['lucide-react'],
        },
      },
    },
  },
});
