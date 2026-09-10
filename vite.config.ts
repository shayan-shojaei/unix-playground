import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages project-page URL is https://<user>.github.io/<repo>/ — adjust
  // this if the repo is renamed, or set to '/' for a user/org page or custom domain.
  base: '/unix-playground/',
  plugins: [react()],
})
