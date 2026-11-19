// The registry fills itself through dynamic imports (one chunk per block);
// tests read it synchronously, so it is loaded once before each test file.
import { loadRegistry } from '../src/core/registry';

await loadRegistry();
