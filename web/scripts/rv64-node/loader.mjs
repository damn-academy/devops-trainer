import { registerHooks } from 'node:module';
import { transformSync } from 'rolldown/utils';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('http://rv64.local/rv64/')) {
      return next(pathToFileURL(resolve(process.env.RV64_PUBLIC, '.' + new URL(specifier).pathname)).href, context);
    }
    if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      const url = new URL(specifier, context.parentURL);
      if (!existsSync(url) && existsSync(fileURLToPath(url) + '.ts')) return next(url.href + '.ts', context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.ts')) return { format: 'module', shortCircuit: true,
      source: transformSync(fileURLToPath(url), readFileSync(new URL(url), 'utf8').replaceAll('import.meta.env', 'globalThis.__rv64Env')).code };
    return next(url, context);
  },
});
