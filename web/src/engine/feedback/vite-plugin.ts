import type { Plugin } from 'vite';
import { appendFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { MAX_BYTES, categories } from './data.ts';
/** Development only: never installs a production receiver or reads stored reports over HTTP. */
export function feedbackPlugin(): Plugin {
  return {
    name: 'dt-feedback',
    config() {
      let commit = 'unknown';
      try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* Source archives lack git metadata. */ }
      return { define: { 'import.meta.env.VITE_BUILD_COMMIT': JSON.stringify(commit) } };
    },
    configureServer(server) {
      server.middlewares.use('/api/feedback', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        const origin = req.headers.origin;
        if (origin && new URL(origin).host !== req.headers.host) { res.statusCode = 403; res.end(); return; }
        try {
          const chunks: Buffer[] = []; let length = 0;
          for await (const chunk of req) { length += chunk.length; if (length > MAX_BYTES) throw new Error('Too large'); chunks.push(Buffer.from(chunk)); }
          const raw = Buffer.concat(chunks);
          const data = req.headers['content-encoding'] === 'gzip' ? gunzipSync(raw, { maxOutputLength: MAX_BYTES }) : raw;
          const report = JSON.parse(data.toString());
          if (report.schema !== 'dt.feedback/v1' || !categories.includes(report.category) || !report.message?.trim() || report.website || !report.id) throw new Error('Invalid report');
          const dir = resolve(server.config.root, '.feedback'); await mkdir(dir, { recursive: true });
          await appendFile(resolve(dir, 'reports.jsonl'), JSON.stringify(report) + '\n', { mode: 0o600 });
          res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ id: report.id }));
        } catch { res.statusCode = 400; res.end('Invalid report'); }
      });
    },
  };
}
