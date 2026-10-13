import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { copy } from './src/content/copy.es.ts'

/** The document description comes from the copy file, like every visitor-facing string. */
function metaDescription(): Plugin {
  const value = copy.meta.description
  return {
    name: 'codice-meta-description',
    transformIndexHtml(html) {
      if (!value || value.startsWith('TODO-AUTHOR')) return html
      const escaped = value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
      return html.replace('</title>', `</title>\n    <meta name="description" content="${escaped}" />`)
    },
  }
}

export default defineConfig({
  plugins: [react(), metaDescription()],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
})
