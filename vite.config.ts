import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const rawMarkdownHashPathPrefix = '\0raw-markdown-hash-path:'

function rawMarkdownHashPathPlugin() {
  return {
    name: 'raw-markdown-hash-path',
    enforce: 'pre' as const,
    resolveId(source: string, importer?: string) {
      if (!importer || !source.includes('#') || !source.includes('.md?raw')) {
        return null
      }

      const [filePath] = source.split('?')
      const importerPath = importer.split('?')[0]
      const resolvedPath = path.resolve(path.dirname(importerPath), filePath)

      if (!fs.existsSync(resolvedPath)) {
        return null
      }

      return `${rawMarkdownHashPathPrefix}${resolvedPath}`
    },
    load(id: string) {
      if (!id.startsWith(rawMarkdownHashPathPrefix)) {
        return null
      }

      const filePath = id.slice(rawMarkdownHashPathPrefix.length)
      const markdown = fs.readFileSync(filePath, 'utf8')

      return `export default ${JSON.stringify(markdown)};`
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [rawMarkdownHashPathPlugin(), react(), tailwindcss()],
  base: '/',
})
