import { loadMarkdownLessons } from '../../core/md-lessons';

export const OSS_LESSONS = loadMarkdownLessons(import.meta.glob<string>(
  ['./*.ru.md', './*.en.md'], { query: '?raw', import: 'default', eager: true },
), 'oss');
