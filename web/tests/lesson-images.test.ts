// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { resolve } from 'node:path';
import { bilingualLessons } from '../src/core/md-lessons';
import { renderMd } from '../src/core/markdown';
import { validateLessonMedia } from '../src/core/lesson-media-plugin';
import { precacheable } from '../src/engine/pwa/vite-plugin';
import { strategyFor } from '../src/engine/pwa/sw-source';

const lesson = (alt: string, caption: string) => `<!-- lesson: sample.image | Image | 5 -->
<!-- section: hook -->
![${alt}](media/aicontent/schema.jpg "${caption}")
<!-- section: sources -->
- Example — https://example.com/
`;
it.each(['ru', 'en'] as const)('loads and renders a %s lesson image with caption', lang => {
  const lessons = bilingualLessons(lesson('Схема', 'Подпись'), lesson('Diagram', 'Caption'));
  const section = lessons[0].sections[0];
  if (section.kind !== 'text') throw new Error('Expected text');
  const raw = section.body[lang];
  validateLessonMedia(raw, resolve('public'));
  const dom = renderMd(raw, { lang });
  const figure = dom.querySelector('figure')!;
  expect(figure.querySelector('img')?.getAttribute('alt')).toBe(lang === 'ru' ? 'Схема' : 'Diagram');
  expect(figure.querySelector('figcaption')?.textContent).toBe(lang === 'ru' ? 'Подпись' : 'Caption');
  expect(figure.querySelector('img')?.getAttribute('loading')).toBe('lazy');
  expect(figure.querySelector('img')?.getAttribute('decoding')).toBe('async');
  expect(figure.querySelector('a')?.getAttribute('target')).toBe('_blank');
  expect(figure.querySelector('a')?.getAttribute('href')).toBe(figure.querySelector('img')?.getAttribute('src'));
});
it('rejects missing files and traversal during the build check, ignores fenced examples', () => {
  expect(() => validateLessonMedia('![x](media/missing.jpg)', resolve('public'))).toThrow('Missing lesson image');
  expect(() => validateLessonMedia('![x](media/../secret.jpg)', resolve('public'))).toThrow('Invalid image path');
  expect(() => validateLessonMedia('```md\n![x](media/missing.jpg)\n```', resolve('public'))).not.toThrow();
  expect(renderMd('![x](media/aicontent/schema.jpg)').querySelector('figcaption')).toBeNull();
});
it('does not precache or runtime-cache large lesson media', () => {
  expect(precacheable('media/aicontent/schema.jpg')).toBe(false);
  expect(strategyFor('https://example.org/media/a.jpg', 'https://example.org/', 'cors', 'GET')).toBe('network');
});
