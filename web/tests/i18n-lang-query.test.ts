import { describe, expect, it } from 'vitest';
import { detectLang, langFromQuery } from '../src/core/i18n';

describe('language from a shared link', () => {
  it('reads ?lang=en and ?lang=ru', () => {
    expect(langFromQuery('?lang=en')).toBe('en');
    expect(langFromQuery('?utm=tg&lang=ru')).toBe('ru');
  });

  it('ignores missing or unknown values', () => {
    expect(langFromQuery('')).toBeNull();
    expect(langFromQuery('?lang=de')).toBeNull();
  });

  it('keeps browser detection when the link does not ask', () => {
    expect(detectLang(null, ['en-US'])).toBe('en');
    expect(detectLang(null, ['ru-RU', 'en-US'])).toBe('ru');
  });
});
