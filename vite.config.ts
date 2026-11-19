import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  build: {
    target: "es2020",
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-vue": ["vue"],
          "vendor-firebase": ["firebase/app", "firebase/auth", "firebase/database"],
          "vendor-xlsx": ["xlsx"]
        }
      }
    }
  }
});
