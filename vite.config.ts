import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

  console.log(
    "SUPABASE URL NO VITE:",
    env.VITE_SUPABASE_URL
      ? "CARREGADA ✅"
      : "NÃO CARREGADA ❌"
  );

  console.log(
    "SUPABASE KEY NO VITE:",
    env.VITE_SUPABASE_PUBLISHABLE_KEY
      ? "CARREGADA ✅"
      : "NÃO CARREGADA ❌"
  );

  return {
    plugins: [react()],

    define: {
      "import.meta.env.VITE_SUPABASE_URL":
        JSON.stringify(
          env.VITE_SUPABASE_URL
        ),

      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY":
        JSON.stringify(
          env.VITE_SUPABASE_PUBLISHABLE_KEY
        ),
    },
  };
});