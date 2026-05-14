import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      }
    }
  },
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react';
          if (id.includes('react-router-dom')) return 'vendor-router';
          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('recharts')) return 'vendor-charts';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('zustand')) return 'vendor-state';
          if (id.includes('@e965/xlsx') || id.includes('/xlsx/')) return 'vendor-xlsx';
          if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('dompurify')) return 'vendor-pdf';
          if (id.includes('leaflet') || id.includes('react-leaflet')) return 'vendor-maps';
          if (id.includes('@hello-pangea/dnd')) return 'vendor-dnd';
          if (id.includes('date-fns')) return 'vendor-date';
          if (id.includes('zod')) return 'vendor-validation';
          return 'vendor-misc';
        },
      },
    },
  },
});
