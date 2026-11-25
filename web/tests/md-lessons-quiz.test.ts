import { expect, it } from 'vitest';
import { bilingualLessons, markdownQuizItems } from '../src/core/md-lessons';

it.each(['\n', '\n\n'])('parses consecutive quiz questions separated by %j', separator => {
  const questions = [
    '? First question?\n+ Correct first || First explanation.\n- Wrong first || First correction.',
    '? Second question?\n- Wrong second || Second correction.\n+ Correct second || Second explanation.',
  ].join(separator);
  const raw = `<!-- lesson: sample.quiz | Sample | 5 -->
<!-- section: hook -->
Opening.
<!-- quiz -->
${questions}
<!-- /quiz -->
<!-- section: sources -->
- Example — https://example.com/
`;
  const items = markdownQuizItems(bilingualLessons(raw, raw));
  expect(items.map(item => item.prompt.en)).toEqual(['First question?', 'Second question?']);
  expect(items.map(item => item.kind === 'mcq' && item.options.map(option => option.correct)))
    .toEqual([[true, false], [false, true]]);
});
