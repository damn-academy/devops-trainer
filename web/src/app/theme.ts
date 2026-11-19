// Theme (system / light / dark) and calm mode, kept per viewer in localStorage
// and applied before first paint by the inline script in index.html.

export type Theme = 'auto' | 'light' | 'dark';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, v: string | null): void {
  try {
    if (v === null) localStorage.removeItem(key);
    else localStorage.setItem(key, v);
  } catch {
    /* private mode */
  }
}

export function getTheme(): Theme {
  const t = read('dt.theme');
  return t === 'light' || t === 'dark' ? t : 'auto';
}

export function setTheme(t: Theme): void {
  write('dt.theme', t === 'auto' ? null : t);
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

/** The theme actually shown (auto resolved through the OS setting). */
export function shownTheme(): 'light' | 'dark' {
  const t = getTheme();
  if (t !== 'auto') return t;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function isCalm(): boolean {
  return document.documentElement.hasAttribute('data-calm');
}

export function setCalm(on: boolean): void {
  write('dt.calm', on ? '1' : null);
  document.documentElement.toggleAttribute('data-calm', on);
}
