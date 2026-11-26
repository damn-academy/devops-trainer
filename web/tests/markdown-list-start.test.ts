// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { renderMd } from '../src/core/markdown';

it('keeps the first number of a list that continues after a paragraph', () => {
  const host = document.createElement('div');
  host.append(renderMd('1. One\n2. Two\n3. Three\n\nA note.\n\n4. Four'));
  const lists = host.querySelectorAll('ol');
  expect(lists).toHaveLength(2);
  expect(lists[0].hasAttribute('start')).toBe(false);
  expect(lists[1].getAttribute('start')).toBe('4');
});
