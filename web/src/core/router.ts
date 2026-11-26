// Hash routes, so the static build works from any folder and offline.
//   #/                     home: the platform catalog (professions and courses)
//   #/profession/<id>      a profession: goal, skills, the program of blocks
//   #/block/<id>           a block: levels, placement entry, lessons
//   #/block/<id>/placement the "show what you know" check
//   #/lesson/<id>          a lesson (optionally #/lesson/<id>/<section>)
//   #/explainer/<id>       a process explainer on its own
//   #/exam/<id>            a block exam
//   #/settings             settings
//   #/review               the review queue
//   #/course/<id>          a hidden pilot course on its own page
//   #/lab/<id>             a standalone lab page (widget `lab:<id>`, e.g. the multi-machine lab)
//   #/local-lab            how to install the local lab dtlab on your own computer
//   #/about                the «Справка» section (optionally #/about/<page>: use, how, deploy, contribute, projects)

export type Route =
  | { name: 'home' }
  | { name: 'profession'; id: string }
  | { name: 'block'; id: string }
  | { name: 'placement'; id: string }
  | { name: 'lesson'; id: string; section?: string }
  | { name: 'explainer'; id: string }
  | { name: 'exam'; id: string }
  | { name: 'messages' }
  | { name: 'settings' }
  | { name: 'review' }
  | { name: 'courses' }
  | { name: 'professions' }
  | { name: 'course'; id: string }
  | { name: 'lab'; id: string }
  | { name: 'local-lab' }
  | { name: 'about'; page?: string }
  | { name: 'notfound'; path: string };

export function parseRoute(hash: string): Route {
  const path = hash.split('?')[0].replace(/^#/, '').replace(/^\/+/, '').replace(/\/+$/, '');
  if (path === '') return { name: 'home' };
  const parts = path.split('/').map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  });
  const [head, id, extra] = parts;
  switch (head) {
    case 'profession':
      if (id && parts.length === 2) return { name: 'profession', id };
      break;
    case 'block':
      if (id && extra === 'placement' && parts.length === 3) return { name: 'placement', id };
      if (id && parts.length === 2) return { name: 'block', id };
      break;
    case 'lesson':
      if (id && parts.length <= 3) return extra ? { name: 'lesson', id, section: extra } : { name: 'lesson', id };
      break;
    case 'explainer':
    case 'exam':
    case 'lab':
      if (id && parts.length === 2) return { name: head, id };
      break;
    case 'about':
      if (parts.length === 1) return { name: 'about' };
      if (id && parts.length === 2) return { name: 'about', page: id };
      break;
    case 'course':
      if (id && parts.length === 2) return { name: 'course', id };
      break;
    case 'messages':
    case 'settings':
    case 'review':
    case 'courses':
    case 'professions':
    case 'local-lab':
      if (parts.length === 1) return { name: head };
      break;
  }
  return { name: 'notfound', path };
}

export function href(r: Route): string {
  const e = encodeURIComponent;
  switch (r.name) {
    case 'home':
      return '#/';
    case 'profession':
      return `#/profession/${e(r.id)}`;
    case 'block':
      return `#/block/${e(r.id)}`;
    case 'placement':
      return `#/block/${e(r.id)}/placement`;
    case 'lesson':
      return r.section ? `#/lesson/${e(r.id)}/${e(r.section)}` : `#/lesson/${e(r.id)}`;
    case 'explainer':
      return `#/explainer/${e(r.id)}`;
    case 'exam':
      return `#/exam/${e(r.id)}`;
    case 'messages':
      return '#/messages';
    case 'settings':
      return '#/settings';
    case 'review':
      return '#/review';
    case 'courses':
      return '#/courses';
    case 'professions':
      return '#/professions';
    case 'course':
      return `#/course/${e(r.id)}`;
    case 'lab':
      return `#/lab/${e(r.id)}`;
    case 'local-lab':
      return '#/local-lab';
    case 'about':
      return r.page ? `#/about/${e(r.page)}` : '#/about';
    case 'notfound':
      return `#/${r.path}`;
  }
}

export function navigate(r: Route): void {
  const target = href(r);
  if (location.hash === target) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = target;
}

export function currentRoute(): Route {
  return parseRoute(location.hash);
}

/** Calls fn now and on every hash change; returns the unsubscribe function. */
export function onRoute(fn: (r: Route) => void): () => void {
  const handler = () => fn(currentRoute());
  window.addEventListener('hashchange', handler);
  handler();
  return () => window.removeEventListener('hashchange', handler);
}
