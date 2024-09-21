// module is installed and works but it still gives error
// @ts-ignore
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
    vite: {
        plugins: [tailwindcss()],
    },
});