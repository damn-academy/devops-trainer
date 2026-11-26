import { describe, expect, it } from 'vitest';
import { strategyFor, swSource } from '../src/engine/pwa/sw-source';
import { precacheable } from '../src/engine/pwa/vite-plugin';

const scope = 'https://trainer.example/course/';

describe('service worker strategies', () => {
  it('routes requests by kind', () => {
    expect(strategyFor(`${scope}`, scope, 'navigate', 'GET')).toBe('navigate');
    expect(strategyFor(`${scope}index.html`, scope, 'no-cors', 'GET')).toBe('navigate');
    expect(strategyFor(`${scope}assets/index-abc123.js`, scope, 'cors', 'GET')).toBe('precached');
    expect(strategyFor(`${scope}v86/buildroot-bzimage.bin`, scope, 'cors', 'GET')).toBe('v86');
    expect(strategyFor(`${scope}assets/v86-Df3x.wasm`, scope, 'cors', 'GET')).toBe('v86');
    expect(strategyFor(`${scope}api/sync`, scope, 'cors', 'GET')).toBe('network');
    expect(strategyFor(`${scope}assets/x.js`, scope, 'cors', 'POST')).toBe('skip');
    expect(strategyFor('https://api.deepseek.com/chat/completions', scope, 'cors', 'GET')).toBe('skip');
    expect(strategyFor(`${scope}manifest.webmanifest`, scope, 'cors', 'GET')).toBe('runtime');
  });

  it('precaches the shell but not maps, the worker itself or the v86 engine', () => {
    expect(precacheable('assets/index-1.js')).toBe(true);
    expect(precacheable('assets/index-1.js.map')).toBe(false);
    expect(precacheable('assets/v86-9f.wasm')).toBe(false);
    expect(precacheable('sw.js')).toBe(false);
    for (const file of ['v86/lab/root.bin', 'rv64/kernel.bin', 'assets/libv86-ab.js', 'assets/rv64-ab.wasm']) expect(precacheable(file)).toBe(false);
  });

  it('generates a worker with the version, the file list and a working strategy function', () => {
    const src = swSource('abc123', ['assets/a.js', 'index.html']);
    expect(src).toContain('const VERSION = "abc123"');
    expect(src).toContain('["assets/a.js","index.html"]');
    // The inlined strategy function is valid JavaScript on its own.
    const fn = new Function(`${src.match(/const strategyFor = ([\s\S]*?);\n\nself\.addEventListener/)![1]}; return 0;`);
    expect(() => fn()).not.toThrow();
    expect(src).not.toContain('skipWaiting();\n});\n\nself.addEventListener(\'activate\'');
  });
});
