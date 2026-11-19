// Pictograms of the process explainer: one clean line drawing per kind of
// participant, on a 24×24 grid, 1.6 px strokes, no fill. They say at a glance
// what a block is (a browser, a DNS server, a folder) and are drawn inside the
// node next to its label.

import type { NodeIcon, NodeWork } from '../../core/types';

export const NODE_ICONS: Record<NodeIcon, string> = {
  browser: 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z M3 9h18 M6.5 6.5h.01 M9.5 6.5h.01 M12.5 6.5h.01',
  server: 'M5 3h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z M5 13h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1Z M8 7h.01 M8 17h.01 M12 7h4 M12 17h4',
  dns: 'M7 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z M4 7h2 M4 12h2 M4 17h2 M10 8h6 M10 12h6 M10 16h3',
  router: 'M4 13h16a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1Z M7 16.5h.01 M10.5 16.5h.01 M8 13 6 6 M16 13l2-7 M9.5 5.5a4 4 0 0 1 5 0 M7.5 3.5a7 7 0 0 1 9 0',
  switch: 'M3 8h18a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z M6 12h.01 M10 12h.01 M14 12h.01 M18 12h.01 M6 5v3 M18 16v3',
  disk: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z M12 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z M12 11h.01 M4 17h16',
  process: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z M12 2.5v3 M12 18.5v3 M2.5 12h3 M18.5 12h3 M5.3 5.3l2.1 2.1 M16.6 16.6l2.1 2.1 M5.3 18.7l2.1-2.1 M16.6 7.4l2.1-2.1',
  file: 'M6 2.5h8l4.5 4.5v14.5H6Z M14 2.5V7h4.5 M9 12h6 M9 15.5h6 M9 19h3.5',
  folder: 'M3 6.5a1.5 1.5 0 0 1 1.5-1.5h5l2 2.5h8a1.5 1.5 0 0 1 1.5 1.5v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5Z M3 10h18',
  user: 'M12 3.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z M4.5 21a7.5 7.5 0 0 1 15 0',
  lock: 'M7 11h10a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z M8.5 11V7.5a3.5 3.5 0 0 1 7 0V11 M12 15v2.5',
  cloud: 'M7 19a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5a4.75 4.75 0 0 1-.5 9.5Z',
  container: 'M12 2.5 3.5 7v10l8.5 4.5 8.5-4.5V7Z M3.5 7 12 11.5 20.5 7 M12 11.5v10',
  terminal: 'M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z M7 9.5l3 2.5-3 2.5 M12.5 15h4.5',
  database: 'M4.5 6c0-1.66 3.36-3 7.5-3s7.5 1.34 7.5 3-3.36 3-7.5 3-7.5-1.34-7.5-3Z M4.5 6v12c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3V6 M4.5 12c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3',
};

/** The busy animation a node shows while it acts, unless it sets its own. */
export function defaultWork(icon: NodeIcon | undefined): NodeWork {
  switch (icon) {
    case 'dns':
    case 'process':
    case 'database':
    case 'lock':
      return 'spin';
    case 'browser':
    case 'terminal':
    case 'user':
      return 'dots';
    default:
      return 'pulse';
  }
}
