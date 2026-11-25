import { addExamples } from './template-examples.mjs';
import ExcelJS from 'exceljs';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const output = fileURLToPath(new URL('../public/templates/', import.meta.url));
const sheet = (ru, en, headers, english) => ({ ru, en, headers: headers.split(', '), english: english.split(', ') });
export const templates = {
  dream100: [
    sheet('Компании', 'Companies', 'account_id, домен, юридическое название, материнская компания, страна, сегмент, ответственный, уровень A/B/C, почему подходит, почему не подходит, стадия, дата стадии, первое касание, последнее касание, следующее действие, дата следующего действия, запрет контактов, платформа виртуализации, своё или арендованное оборудование, модель развёртывания, модель клиентов, требования регулятора, срок продления или миграции, кто проверил', 'account_id, domain, legal name, parent company, country, segment, owner, tier A/B/C, why it fits, why it does not fit, stage, stage date, first touch, last touch, next action, next action date, do not contact, virtualization platform, owned or rented hardware, deployment model, customer model, regulatory requirements, renewal or migration deadline, verified by'),
    sheet('Люди', 'People', 'person_id, имя, профессиональная страница, рабочие контакты, роль, часовой пояс, язык, удобный канал, дата проверки', 'person_id, name, professional profile, work contact details, role, time zone, language, preferred channel, verification date'),
    sheet('Трудоустройство', 'Employment', 'person_id, account_id, должность, начало, конец, источник, дата наблюдения', 'person_id, account_id, job title, start, end, source, observation date'),
    sheet('Закупочный центр', 'Buying center', 'account_id, инициатива, person_id, роль, приоритеты, признаки влияния, отношение, кто может познакомить, сила отношений 0–4, доказательство, дата, разрешение ссылаться', 'account_id, initiative, person_id, role, priorities, evidence of influence, attitude, potential introducer, relationship strength 0–4, evidence, date, permission to reference'),
    sheet('Сигналы', 'Signals', 'signal_id, account_id, person_id, тип, ссылка, выдержка факта, дата события, дата обнаружения, уверенность, способ сопоставления, дата пересмотра, значимость, кто оценил', 'signal_id, account_id, person_id, type, link, factual excerpt, event date, discovery date, confidence, matching method, review date, significance, assessed by'),
    sheet('Действия', 'Activities', 'дата, направление, канал, person_id, account_id, исполнитель, результат, обещано, следующий шаг', 'date, direction, channel, person_id, account_id, performed by, outcome, commitment, next step'),
    sheet('Возможности', 'Opportunities', 'account_id, инициатива, спонсор, проблема, согласованная оценка, технические критерии, бюджет и путь закупки, следующее решение, причина проигрыша', 'account_id, initiative, sponsor, problem, agreed assessment, technical criteria, budget and procurement process, next decision, loss reason'),
    sheet('Запреты', 'Do not contact', 'адрес или человек, дата, источник, основание', 'address or person, date, source, reason'),
  ],
  'event-map': [sheet('Мероприятия', 'Events', 'группа, город и язык, контакт организатора, удобный канал, последняя встреча, аудитория, ссылка на событие, ссылка на приём заявок, срок с часовым поясом, формат, расходы и помощь с поездкой, тема и версия доклада, статус, последний контакт, следующее действие, права на запись', 'group, city and language, organizer contact, preferred channel, last meetup, audience, event link, call for proposals link, deadline with time zone, format, costs and travel support, talk topic and version, status, last contact, next action, recording rights')],
  'llm-panel': [sheet('Ответы LLM', 'LLM responses', 'дата, модель и версия, поиск включён, язык, вопрос, повтор 1–3, упомянут ли продукт, верна ли категория, верна ли лицензия, верны ли возможности, ссылки в ответе, ошибка и вероятный источник', 'date, model and version, search enabled, language, question, repetition 1–3, product mentioned, correct category, correct license, correct capabilities, links in response, error and likely source')],
  'signals-week': [sheet('Сигналы недели', 'Weekly signals', 'источник, задача пользователя, кто сообщил, тип пользователя: пробует/рабочая среда/платит, дословная цитата, ссылка', 'source, user task, reported by, user type: evaluating/production/paying, verbatim quote, link')],
};
addExamples(templates, sheet);
await mkdir(output, { recursive: true });
for (const [file, sheets] of Object.entries(templates)) for (const en of [false, true]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'damn.academy';
  workbook.created = workbook.modified = new Date('2026-01-01T00:00:00Z');
  for (const spec of sheets) {
    const ws = workbook.addWorksheet(en ? spec.en : spec.ru);
    ws.addRow(en ? spec.english : spec.headers);
    for (const row of spec.rows?.[en ? "en" : "ru"] ?? []) ws.addRow(row);
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).alignment = { wrapText: true, vertical: 'top' };
    ws.getRow(1).height = 45;
    ws.columns.forEach(c => { c.width = 26; });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: spec.headers.length } };
    const list = (column, values) => {
      for (let row = 2; row <= 1001; row++) ws.getCell(row, column).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${values}"`], showErrorMessage: true, errorStyle: 'stop', errorTitle: en ? 'Invalid value' : 'Недопустимое значение', error: en ? 'Choose a value from the list.' : 'Выберите значение из списка.' };
    };
    if (spec.ru === 'Компании') {
      list(8, 'A,B,C');
      list(11, en ? 'unaware,aware,engaged,meeting scheduled,meeting,opportunity,monitoring,not a fit,won,lost' : 'не знают о нас,знают,вовлечены,встреча назначена,встреча,возможность,наблюдаем,не подходит,выиграли,проиграли');
    }
    if (spec.ru === 'Закупочный центр') list(9, '0,1,2,3,4');
  }
  await workbook.xlsx.writeFile(`${output}/${file}${en ? '-en' : ''}.xlsx`);
}
