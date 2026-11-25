import { loadMarkdownLessons } from '../../../core/md-lessons';

export const PRODUCT_V2_LESSONS = loadMarkdownLessons(import.meta.glob<string>(
  ['./*.ru.md', './*.en.md'], { query: '?raw', import: 'default', eager: true },
), 'product');
