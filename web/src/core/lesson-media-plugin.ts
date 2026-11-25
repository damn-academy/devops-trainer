import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { markdownImage } from './markdown-image.ts';

/** Same standalone syntax as the renderer; examples inside fences are ignored. */
export function validateLessonMedia(raw: string, publicDir: string): void {
  let fence = '';
  for (const line of raw.split(/\r?\n/)) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = '';
      continue;
    }
    if (fence) continue;
    const image = markdownImage(line);
    if (image && !statSync(resolve(publicDir, image.src), { throwIfNoEntry: false })?.isFile()) {
      throw new Error(`Missing lesson image: ${image.src}`);
    }
  }
}

export function lessonMediaPlugin(): Plugin {
  let root = '', publicDir = '';
  return {
    name: 'dt-lesson-media',
    configResolved(config) { root = config.root; publicDir = config.publicDir; },
    buildStart() {
      const walk = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const path = resolve(dir, entry.name);
          if (entry.isDirectory()) walk(path);
          else if (/\.(ru|en)\.md$/.test(path)) {
            this.addWatchFile(path);
            try { validateLessonMedia(readFileSync(path, 'utf8'), publicDir); }
            catch (error) { throw new Error(`${path}: ${String(error)}`); }
          }
        }
      };
      walk(resolve(root, 'src/blocks'));
    },
  };
}
