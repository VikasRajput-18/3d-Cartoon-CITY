import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { compression } from 'vite-plugin-compression2'

export default defineConfig({
  plugins: [
    react(),
    compression({ algorithm: 'gzip',   ext: '.gz' }),
    compression({ algorithm: 'brotliCompress', ext: '.br' }),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: {
    target: 'esnext',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.warn', 'console.info'],
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('react-router-dom')) return 'react-vendor'
          if (id.includes('node_modules/three/'))               return 'three-vendor'
          if (id.includes('@react-three/fiber'))                return 'r3f-vendor'
          if (id.includes('@react-three/drei'))                 return 'drei-vendor'
          if (id.includes('node_modules/@clerk/'))              return 'clerk-vendor'
          if (id.includes('node_modules/framer-motion/'))       return 'framer-vendor'
          if (id.includes('node_modules/@supabase/'))           return 'supabase-vendor'
          if (id.includes('node_modules/zustand/'))             return 'zustand-vendor'
        },
      },
    },
  },
})
