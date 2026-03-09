import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mockApiPlugin = () => ({
  name: 'mock-api',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      // Common body parser for our mock endpoints
      if (req.url.startsWith('/api/') && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString() });
        req.on('end', () => {
          try {
            const payload = JSON.parse(body);
            const dataPath = path.resolve(__dirname, 'src/data/contacts.json');
            const contacts = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

            if (req.url === '/api/record-call') {
              const { contactId, result, notes } = payload;
              const cIndex = contacts.findIndex(c => c.id === contactId);
              if (cIndex > -1) {
                contacts[cIndex].status = 'CALLED';
                contacts[cIndex].surveyResult = result;
                contacts[cIndex].notes = notes;
              }
            } else if (req.url === '/api/assign-quota') {
              const { volunteerId, count } = payload;
              let assignedCount = 0;
              for (let i = 0; i < contacts.length; i++) {
                if (!contacts[i].assignedTo && assignedCount < count) {
                  contacts[i].assignedTo = volunteerId;
                  assignedCount++;
                }
              }
            }

            fs.writeFileSync(dataPath, JSON.stringify(contacts, null, 2));
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      } else {
        next();
      }
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), mockApiPlugin()],
  server: {
    port: 5173,
    strictPort: true
  }
})
