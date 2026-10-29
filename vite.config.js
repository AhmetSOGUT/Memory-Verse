import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Geliştirirken /api istekleri sunucuya (server/ klasörü) yönlenir.
    // Tarayıcı yalnızca localhost:5173'ü görür: çerez ve CSRF koruması aynı kaynak gibi çalışır.
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
})