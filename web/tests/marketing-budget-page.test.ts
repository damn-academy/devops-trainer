// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { budgetWidget } from '../src/blocks/marketing/v2/budget';
import { setLang } from '../src/core/i18n';

afterEach(() => { setLang('ru'); document.body.replaceChildren(); });

it('shows cumulative funnel totals and updates them when the allocation changes', () => {
  setLang('en');
  const el = document.createElement('div'), complete = vi.fn();
  document.body.append(el);
  const widget = budgetWidget.mount(el, { total: 10000 }, {
    level: 'beginner', complete, record: vi.fn(), openDoc: vi.fn(),
  });
  try {
    const funnel = el.querySelector('.mkt-budget-funnel')!;
    expect(funnel.children).toHaveLength(3);
    expect(funnel.textContent).toContain('Month 12: 600 → 50.0 → 6.0');
    const input = el.querySelector<HTMLInputElement>('input[type=range]')!;
    input.value = '0'; input.dispatchEvent(new Event('input'));
    expect(funnel.textContent).not.toContain('600 → 50.0 → 6.0');
    expect(complete).toHaveBeenCalledOnce();
    const reset = [...el.querySelectorAll('button')].find(b => b.textContent === 'Reset')!;
    reset.click();
    expect(funnel.textContent).toContain('Month 12: 600 → 50.0 → 6.0');
    // An own budget replaces the course's 10,000 and scales the allocation down.
    const budget = el.querySelector<HTMLInputElement>('input[type=number]')!;
    budget.value = '5000'; budget.dispatchEvent(new Event('change'));
    expect(el.textContent).toMatch(/Allocated \/ monthly budget, USD: [\d,]+ \/ 5,000/);
    // A changed or rejected amount is explained next to the field.
    budget.value = '41667'; budget.dispatchEvent(new Event('change'));
    expect(budget.value).toBe('41500'); expect(el.textContent).toContain('rounded to 41,500');
    budget.value = '250000'; budget.dispatchEvent(new Event('change'));
    expect(budget.value).toBe('41500'); expect(el.textContent).toContain('previous budget of 41,500 stays');
  } finally { widget.dispose?.(); }
  expect(el.children).toHaveLength(0);
});
