import { loadMarkdownLessons } from './parser';

export const MARKETING_V2_LESSONS = loadMarkdownLessons(import.meta.glob<string>(
  ['./*.ru.md', './*.en.md'], { query: '?raw', import: 'default', eager: true },
));
