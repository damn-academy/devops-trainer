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

it.each(['mp4', 'webm', 'MP4'])('renders a %s video figure with accessible controls and caption', ext => {
  const dom = renderMd(`![Voice and subtitles](media/sample.${ext} "Audio timeline")`);
  const figure = dom.querySelector('figure.md-image')!;
  const video = figure.querySelector('video')!;
  expect(video.getAttribute('src')).toBe(`${import.meta.env.BASE_URL}media/sample.${ext}`);
  expect(video.controls).toBe(true);
  expect(video.preload).toBe('metadata');
  expect(video.playsInline).toBe(true);
  expect(video.getAttribute('aria-label')).toBe('Voice and subtitles');
  expect(video.autoplay).toBe(false);
  expect(figure.querySelector('figcaption')?.textContent).toBe('Audio timeline');
  expect(figure.querySelector('a, img')).toBeNull();
  expect(renderMd(`![](media/sample.${ext})`).querySelector('figcaption')).toBeNull();
});

it.each(['txt', 'srt', 'm4a', 'mp4', 'webm'])('resolves media %s links like images and makes them downloads', ext => {
  const path = `media/aicontent/video-kit/sample.${ext}`;
  const dom = renderMd(`![Sample](${path})\n\nDownload [**source**](${path}).`);
  const link = dom.querySelector('p a')!;
  expect(link.getAttribute('href')).toBe(`${import.meta.env.BASE_URL}${path}`);
  expect(link.getAttribute('href')).toBe(dom.querySelector('img, video')?.getAttribute('src'));
  expect(link.hasAttribute('download')).toBe(true);
  expect(link.hasAttribute('target')).toBe(false);
  expect(link.querySelector('strong')?.textContent).toBe('source');
});

it('preserves HTML, external and lesson links without downloading them', () => {
  const dom = renderMd('[Page](media/demo.html) [Page](media/demo.HTM?view=1) [Web](https://example.org/file.txt) [Lesson](#/lesson/aicontent.video)');
  const links = [...dom.querySelectorAll('a')];
  expect(links.map(a => a.hasAttribute('download'))).toEqual([false, false, false, false]);
  expect(links[0].getAttribute('href')).toBe(`${import.meta.env.BASE_URL}media/demo.html`);
  expect(links[2].target).toBe('_blank');
  expect(links[2].rel).toBe('noopener noreferrer');
  expect(links[3].getAttribute('href')).toBe('#/lesson/aicontent.video');
  expect(renderMd('[Unsafe](javascript:alert)').textContent).toBe('[Unsafe](javascript:alert)');
});

it.each(['before.mp4', 'after.webm', 'script.txt', 'line-1.m4a', 'subtitles.srt'])('keeps %s out of service worker caches', file => {
  const path = `media/aicontent/video-kit/${file}`;
  expect(precacheable(path)).toBe(false);
  expect(strategyFor(`https://example.org/course/${path}`, 'https://example.org/course/', 'navigate', 'GET')).toBe('network');
});
