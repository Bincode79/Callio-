import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [".prod-runtime.all-hands.dev", "localhost"],
    // Chuyển tiếp /api sang backend giọng nói (backend/voice) khi chạy dev.
    // Không có backend thì proxy trả lỗi và giao diện tự lùi về Web Speech API.
    proxy: {
      "/api": {
        target: process.env.CALLIO_VOICE_API_TARGET ?? "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    allowedHosts: [".prod-runtime.all-hands.dev", "localhost"],
  },
  optimizeDeps: {
    exclude: [
      "same-runtime/dist/jsx-dev-runtime",
      "same-runtime/dist/jsx-runtime",
    ],
  },
});
