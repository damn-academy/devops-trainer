// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { roundNumbers, franchiseNumbers, ROUND_DEFAULTS, FRANCHISE_DEFAULTS, roundWidget, franchiseWidget } from '../src/blocks/finance/widgets';
import { FINANCE_MODULES } from '../src/blocks/finance/structure';
import { registry } from '../src/core/registry';
import { parseMarkdownLessons } from '../src/core/md-lessons';
import { visibleProducts } from '../src/core/products';
import { setLang } from '../src/core/i18n';

it('reproduces SAFE conversion and both round prices without intermediate rounding', () => {
  const r = roundNumbers(ROUND_DEFAULTS);
  for (const [stage, expected] of [[r.before, [85,10,5,0,0]], [r.withoutPool,[68,8,4,0,20]], [r.withPool,[59.5,7,3.5,10,20]]] as const) {
    stage.ownership.forEach((v,i)=>expect(v).toBeCloseTo(expected[i],10));
    expect(stage.ownership.reduce((a,b)=>a+b,0)).toBeCloseTo(100,10);
  }
  expect(r.withoutPool.price).toBeCloseTo(2.125,10);
  expect(r.withPool.price).toBeCloseTo(1.859375,10);
  expect(r.withPool.newShares).toBeCloseTo(5_000_000/1.859375,8);
});
it('tops up an existing pool, never removes it, and handles no SAFEs and three SAFEs', () => {
  const r=roundNumbers({...ROUND_DEFAULTS,existingPool:2_000_000});
  expect(r.withPool.shares[3]).toBeGreaterThanOrEqual(2_000_000);
  expect(r.withPool.price).toBe(r.withoutPool.price);
  expect(roundNumbers({...ROUND_DEFAULTS,safes:[]}).before.ownership[0]).toBe(100);
  const three=roundNumbers({...ROUND_DEFAULTS,safes:[...ROUND_DEFAULTS.safes,{amount:100_000,cap:10_000_000}]});
  expect(three.withPool.ownership.reduce((a,b)=>a+b,0)).toBeCloseTo(100);
  expect(()=>roundNumbers({...ROUND_DEFAULTS,poolPercent:80})).toThrow();
  expect(()=>roundNumbers({...ROUND_DEFAULTS,safes:[{amount:10,cap:10}]})).toThrow();
  expect(()=>roundNumbers({...ROUND_DEFAULTS,founder:NaN})).toThrow();
});
it('reproduces both Delaware methods and the annual fee', () => {
  expect(franchiseNumbers(FRANCHISE_DEFAULTS)).toEqual({authorized:85165,assumed:1200,tax:1200,fee:50,total:1250,instalments:false});
  for(const [shares,tax] of [[5000,175],[5001,250],[10000,250],[10001,335]]) expect(franchiseNumbers({...FRANCHISE_DEFAULTS,authorized:shares,issued:shares,assets:0}).authorized).toBe(tax);
  expect(franchiseNumbers({...FRANCHISE_DEFAULTS,par:1}).assumed).toBe(4000);
  expect(franchiseNumbers({...FRANCHISE_DEFAULTS,assets:40_000_000}).instalments).toBe(true);
  expect(franchiseNumbers({...FRANCHISE_DEFAULTS,authorized:100_000_000,assets:1e12}).tax).toBe(200000);
  expect(()=>franchiseNumbers({...FRANCHISE_DEFAULTS,issued:0})).toThrow();
  expect(()=>franchiseNumbers({...FRANCHISE_DEFAULTS,issued:20_000_000})).toThrow();
});
it('publishes all thirteen supplied finance lessons in six modules', () => {
  const ids=FINANCE_MODULES.flatMap(m=>m.lessons);
  expect(ids).toHaveLength(13); expect(new Set(ids).size).toBe(13);
  expect(registry.blocks.get('finance')!.lessons).toEqual(ids);
  expect(visibleProducts('course').filter(p=>p.shelf==='business').map(p=>p.id)).toEqual(['marketing','sales','product','events','oss','strategy','finance','pr','scithink']);
  for(const id of ids) {
    const lesson=registry.lessons.get(id)!; expect(lesson.summary?.en).toBeTruthy();
    for(const s of lesson.sections) if(s.kind==='widget') expect(registry.widgets.has(s.widget),s.widget).toBe(true);
  }
  expect(registry.errors).toEqual([]);
});
it('preserves lesson sections, widgets, quiz order and URLs in English', () => {
  const files=import.meta.glob<string>('../src/blocks/finance/*.md',{query:'?raw',import:'default',eager:true});
  for(const [file,ru] of Object.entries(files).filter(([f])=>f.endsWith('.ru.md'))) {
    const en=files[file.replace('.ru.md','.en.md')]; expect(en,file).toBeTruthy();
    const shape=(raw:string)=>parseMarkdownLessons(raw).map(l=>({id:l.id,sections:l.sections.map(s=>({kind:s.kind,widget:s.widget,props:s.props}))}));
    expect(shape(en)).toEqual(shape(ru));
    const urls=(s:string)=>s.match(/https?:\/\/[^\s)]+/g);
    expect(urls(en)).toEqual(urls(ru));
    const quiz=(s:string)=>s.split('\n').filter(l=>/^[?+-] /.test(l)&&!l.startsWith('- http')).filter(l=>l.startsWith('? ')||l.includes(' || ')).map(l=>l[0]);
    expect(quiz(en)).toEqual(quiz(ru));
  }
});
it('updates accessible widget results and rejects invalid input', () => {
  setLang('ru');
  for(const widget of [roundWidget,franchiseWidget]) {
    const el=document.createElement('div'); const mounted=widget.mount(el,{},{} as never);
    expect(el.querySelector('table')).not.toBeNull();
    const input=el.querySelector('input')!; input.value=''; input.dispatchEvent(new Event('input'));
    expect(el.textContent).toContain('Проверьте значения');
    expect(el.textContent).not.toContain('NaN'); mounted.dispose(); expect(el.children).toHaveLength(0);
  }
});
