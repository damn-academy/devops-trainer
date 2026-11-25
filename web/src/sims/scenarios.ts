import core from './core.ru.md?raw';
import world from './world.ru.md?raw';
import { registerScenarios } from '../engine/deptsim/registry';
import type { SimScenario } from '../engine/deptsim/types';
import department0 from './marketing-quarter.ru.md?raw';
import department1 from './marketing-blog.ru.md?raw';
import department2 from './pr-crisis.ru.md?raw';
import department3 from './product-quarter.ru.md?raw';
import department4 from './sales-dream.ru.md?raw';
import department5 from './events-kubecon.ru.md?raw';
import department6 from './oss-incubation.ru.md?raw';

// TODO(en-prompts): Use Russian GM prose until English content is supplied.
const premise = (text: string) => text.split(/\n\s*\n/)[0].match(/[^.!?]+[.!?]/g)!.slice(0, 2).join('').trim();
export const scenarios: SimScenario[] = [
  { id: "marketing.quarter", dept: "marketing", title: { ru: "Квартал в отделе маркетинга", en: "A quarter in the marketing department" },
    premise: { ru: premise(department0), en: "The player leads the company’s marketing. Before their arrival, the company had barely done any marketing: the founder posted on LinkedIn when time allowed, while engineers maintained the website and blog between releases." },
    turns: { min: 6, max: 8, default: 6 }, turnUnit: { ru: "две недели", en: "two weeks" },
    prompt: { ru: core, en: core }, world, department: department0, russianPrompt: true },
  { id: "marketing.blog", dept: "marketing", title: { ru: "Технический блог до тысячи подписчиков", en: "Growing a technical blog to a thousand subscribers" },
    premise: { ru: premise(department1), en: "The player is responsible for the company’s technical blog. The blog has been around for two years and has forty posts: half are release announcements, and the rest were written by engineers when something interested them." },
    turns: { min: 8, max: 12, default: 12 }, turnUnit: { ru: "две недели", en: "two weeks" },
    prompt: { ru: core, en: core }, world, department: department1, russianPrompt: true },
  { id: "pr.crisis", dept: "pr", title: { ru: "Неделя кризиса", en: "A week of crisis" },
    premise: { ru: premise(department2), en: "The player is responsible for the company’s public communications: press relations, statements, relationships with journalists and analysts, and the company’s tone on social media and in the community. The game begins on Monday morning, and two stories land on the player’s desk simultaneously in the very first turn." },
    turns: { min: 6, max: 12, default: 10 }, turnUnit: { ru: "полдня, затем день и неделя", en: "half a day, then a day and a week" },
    prompt: { ru: core, en: core }, world, department: department2, russianPrompt: true },
  { id: "product.quarter", dept: "product", title: { ru: "Продуктовый квартал", en: "A product quarter" },
    premise: { ru: premise(department3), en: "The player leads the company’s product. The product has an open-source edition used by hundreds of companies and a paid edition with support, a managed service, and several features for large customers." },
    turns: { min: 4, max: 8, default: 6 }, turnUnit: { ru: "две недели", en: "two weeks" },
    prompt: { ru: core, en: core }, world, department: department3, russianPrompt: true },
  { id: "sales.dream100", dept: "sales", title: { ru: "Dream 100: основатель переезжает в США", en: "Dream 100: the founder moves to the US" },
    premise: { ru: premise(department4), en: "The player is the company’s founder and personally handles sales. They have just moved from Europe to the US to sell in person and have a list of one hundred target companies: banks, telecom operators, large hosting providers, companies moving away from VMware, and companies building their own GPU clouds." },
    turns: { min: 12, max: 26, default: 16 }, turnUnit: { ru: "неделя", en: "one week" },
    prompt: { ru: core, en: core }, world, department: department4, russianPrompt: true },
  { id: "events.kubecon", dept: "mixed", title: { ru: "KubeCon через восемь недель", en: "KubeCon in eight weeks" },
    premise: { ru: premise(department5), en: "The player is responsible for the company’s events. KubeCon starts in eight weeks, and the company is attending in earnest for the first time." },
    turns: { min: 10, max: 14, default: 12 }, turnUnit: { ru: "неделя, на конференции полдня", en: "one week, half a day at the conference" },
    prompt: { ru: core, en: core }, world, department: department5, russianPrompt: true },
  { id: "oss.incubation", dept: "mixed", title: { ru: "Год проекта в инкубаторе CNCF", en: "A year in CNCF incubation" },
    premise: { ru: premise(department6), en: "The player is the lead maintainer of an open-source project that its founding company donated to CNCF. The project recently moved from Sandbox to Incubating." },
    turns: { min: 6, max: 12, default: 12 }, turnUnit: { ru: "месяц", en: "one month" },
    prompt: { ru: core, en: core }, world, department: department6, russianPrompt: true },
];
export function registerDepartmentScenarios(): void { registerScenarios(scenarios); }
