import { expect, it } from 'vitest';
import { roiDefaults, simulate, trainers } from '../src/engine/trainers/model';
import { eventVisitor } from '../src/engine/trainers/events';
import { scenarios } from '../src/sims/scenarios';
import { buildPrompt } from '../src/engine/deptsim/model';
import { defaultCompanyConfig } from '../src/sims/companies';

it('deduplicates target accounts before simulation and preserves deterministic boundaries', () => {
  const all = {...roiDefaults, scans:10, target:1, dedup:.5, contacted:1, meeting:1, opportunity:1, winRate:1, cost:1};
  expect(simulate(all)).toEqual({median:5,probability:1});
  expect(simulate({...all,dedup:0})).toEqual({median:0,probability:0});
  expect(simulate({...all,winRate:0}).probability).toBe(0);
  expect(simulate({...all,cost:0,dedup:0}).probability).toBe(1);
  expect(simulate(roiDefaults)).toEqual(simulate(roiDefaults));
});
it('uses venue and segment roles and removes the fixed paid booth and CNCF entitlement', () => {
  const trainer = trainers.find(t => t.id === 'events.booth-visitor')!;
  for (const [venue,segment,role] of [['PGConf','PostgreSQL','DBA'],['RSAC','Security','безопасност'],['NANOG','Networking','сетевой'],['SREcon','SRE','дежурный']]) {
    const prompt = eventVisitor(trainer,venue,segment).role;
    expect(prompt).toContain(venue); expect(prompt).toContain(role); expect(prompt).not.toContain('на KubeCon');
  }
  const scenario = scenarios.find(s => s.id === 'events.kubecon')!;
  const opts = {seed:42,company:'stratova',companyMode:'custom' as const,companyConfig:{...defaultCompanyConfig(),code:'proprietary'},difficulty:'like-life' as const,turns:12};
  const prompt = buildPrompt(scenario,opts,'ru');
  expect(prompt).toContain('Participation format: no booth');
  expect(prompt).not.toContain('Основатель уже заплатил');
  expect(prompt).not.toContain('проект компании состоит в CNCF');
  expect(buildPrompt(scenario,{...opts,eventFormat:'booth'},'ru')).toContain('A booth is being considered, not prepaid');
});
