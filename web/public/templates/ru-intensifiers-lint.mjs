// Minimal Russian intensifier checker. Candidates require human review.
// Usage: node ru-intensifiers-lint.mjs input.txt
import { readFileSync } from 'node:fs';
if (process.argv.length !== 3) {
  console.error('Usage: node ru-intensifiers-lint.mjs input.txt');
  process.exit(2);
}
const lines = readFileSync(process.argv[2], 'utf8').split(/\r?\n/);
lines.forEach((line, index) => {
  for (const match of line.matchAll(/(?<![\p{L}\p{N}_])(очень|невероятно|чрезвычайно)(?![\p{L}\p{N}_])/giu)) {
    console.log(`${index + 1}:${match.index + 1}: review "${match[0]}"`);
  }
});
