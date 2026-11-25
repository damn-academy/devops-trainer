// Catalog art: one line icon and one accent hue per profession or course.
// Icons are drawn on a 24×24 grid with the same stroke as the site icons, so
// they sit next to the interface without looking pasted in. The hue feeds the
// tile's --accent; light and dark themes mix it with their own background.

import type { Product } from '../core/products';

interface Art { paths: string[]; hue: number }

const ART: Record<string, Art> = {
  // An endless delivery loop with a forward arrow.
  devops: { hue: 238, paths: ['M7 8.5a3.5 3.5 0 1 0 0 7c2.2 0 3.3-1.6 5-3.5s2.8-3.5 5-3.5a3.5 3.5 0 1 1 0 7c-2.2 0-3.3-1.6-5-3.5S9.2 8.5 7 8.5Z', 'M15.5 6.5 17 8.5l-2 1.2'] },
  // A megaphone with sound lines.
  marketing: { hue: 14, paths: ['M4 10v4h3l6 4V6L7 10H4Z', 'M7 14l1 5h2.2l-.8-4', 'M16.5 9.5a3.5 3.5 0 0 1 0 5', 'M18.8 7.3a6.6 6.6 0 0 1 0 9.4'] },
  // A target with an arrow in the centre.
  sales: { hue: 152, paths: ['M12 4a8 8 0 1 0 8 8', 'M12 8a4 4 0 1 0 4 4', 'M12 12l7-7', 'M16.5 4.5 19 5l.5 2.5'] },
  // Three stacked layers of a product.
  product: { hue: 268, paths: ['M12 4 3.5 8.5 12 13l8.5-4.5L12 4Z', 'M3.5 12.5 12 17l8.5-4.5', 'M3.5 16.5 12 21l8.5-4.5'] },
  // A stage microphone.
  events: { hue: 38, paths: ['M9 4.5a3 3 0 0 1 6 0V11a3 3 0 0 1-6 0V4.5Z', 'M5.5 10.5a6.5 6.5 0 0 0 13 0', 'M12 17v3.5', 'M8.5 20.5h7'] },
  // A git branch that merges back.
  oss: { hue: 184, paths: ['M7 4.5v15', 'M7 15.5c0-3.5 10-2.5 10-7', 'M7 6.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z', 'M17 8.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z', 'M7 21.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z'] },
  // A compass with its needle.
  strategy: { hue: 210, paths: ['M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Z', 'm15.5 8.5-2 5-5 2 2-5 5-2Z'] },
  // A folded newspaper.
  pr: { hue: 338, paths: ['M5 5h11v13.5a1.5 1.5 0 0 0 1.5 1.5H6.5A1.5 1.5 0 0 1 5 18.5V5Z', 'M16 9h3v9.5a1.5 1.5 0 0 1-3 0', 'M8 8.5h5', 'M8 11.5h5', 'M8 14.5h3'] },
  // A flask with a bubble.
  aicontent: { hue: 300, paths: ['M12 3.5 13.6 8l4.4 1.6-4.4 1.6L12 15.7l-1.6-4.5L6 9.6 10.4 8 12 3.5Z', 'M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z', 'M5.5 15.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6.6-1.6Z'] },
  scithink: { hue: 92, paths: ['M9.5 3.5h5', 'M10.5 3.5v5.2L5.4 17.4A2 2 0 0 0 7.1 20.5h9.8a2 2 0 0 0 1.7-3.1l-5.1-8.7V3.5', 'M7.5 14h9', 'M13.5 17a.8.8 0 1 0 0-.01'] },
};

const FALLBACK: Art = { hue: 238, paths: ['M5 5h14v14H5z'] };

const NS = 'http://www.w3.org/2000/svg';

export function catalogArt(p: Product): { hue: number; svg: SVGElement } {
  const art = ART[p.id] ?? FALLBACK;
  const svg = document.createElementNS(NS, 'svg');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: 'catalog-icon' })) svg.setAttribute(k, v);
  for (const d of art.paths) {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return { hue: art.hue, svg };
}
