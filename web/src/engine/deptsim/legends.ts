import { companyLegends } from '../../sims/companies';
// TODO(en-prompts): Company prose follows the Russian GM prompt for now.
export const legends = companyLegends.map(l => ({ id: l.id, title: { ru: l.label, en: l.label }, text: { ru: l.text, en: l.text } }));
