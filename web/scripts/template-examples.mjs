// Russian cells reuse lesson wording; unprovided prose stays with the editor.
export function addExamples(templates, sheet) {
  const date = '2026-11-25', next = '2026-12-02';
  const pair = (ru, en) => ({ ru, en });
  const rows = (spec, ru, en) => { spec.rows = pair(ru, en); };
  rows(templates.dream100[0], [['A001','westhost.example','Вестхост','','','хостинг-провайдер','','A','хостинг-провайдер','','вовлечены',date,'',date,'квалификационная встреча',next,'','VMware']], [['A001','westhost.example','Westhost','','','hosting provider','','A','hosting provider','','engaged',date,'',date,'qualification meeting',next,'','VMware']]);
  rows(templates.dream100[1], ['P001','P002','P003'].map((id,i)=>[id,id,`https://westhost.example/people/${id}`,'',['инженер','владелец платформы','экономический покупатель с бюджетом'][i],'UTC','','',date]), ['P001','P002','P003'].map((id,i)=>[id,id,`https://westhost.example/people/${id}`,'',['engineer','platform owner','economic buyer'][i],'UTC','','',date]));
  rows(templates.dream100[2], ['P001','P002','P003'].map((id,i)=>[id,'A001',['инженер','владелец платформы','экономический покупатель с бюджетом'][i],date,'',`https://westhost.example/people/${id}`,date]), ['P001','P002','P003'].map((id,i)=>[id,'A001',['engineer','platform owner','economic buyer'][i],date,'',`https://westhost.example/people/${id}`,date]));
  rows(templates.dream100[3], ['P001','P002','P003'].map((id,i)=>['A001','VMware',id,['инженер','владелец платформы','экономический покупатель с бюджетом'][i],'','','','',i === 0 ? 2 : 0,`https://westhost.example/people/${id}`,date,'']), ['P001','P002','P003'].map((id,i)=>['A001','VMware',id,['engineer','platform owner','economic buyer'][i],'','','','',i === 0 ? 2 : 0,`https://westhost.example/people/${id}`,date,'']));
  rows(templates.dream100[4], [['S001','A001','P001','вакансия','https://westhost.example/jobs','компания ищет инженера по Kubernetes',date,date,'','','','','P001']], [['S001','A001','P001','vacancy','https://westhost.example/jobs','The company is hiring a Kubernetes engineer',date,date,'','','','','P001']]);
  rows(templates.dream100[5], [[date,'','почта','P001','A001','','был содержательный разговор в обе стороны','','квалификационная встреча']], [[date,'','email','P001','A001','','substantive two-way conversation','','qualification meeting']]);
  // An initiative is an opportunity only after buyer confirmation; unknowns stay blank.
  rows(templates.dream100[6], [['A001','VMware','P003','','квалификационная встреча']], [['A001','VMware','P003','','qualification meeting']]);
  rows(templates.dream100[7], [['P003',date,'https://westhost.example/people/P003','просьба не писать']], [['P003',date,'https://westhost.example/people/P003','do not contact request']]);
  templates['event-map'] = [
    sheet('Группы','Groups','group_id, группа, город и язык, контакт организатора, удобный канал, последняя встреча, аудитория, следующий шаг, дата следующего действия','group_id, group, city and language, organizer contact, preferred channel, last meetup, audience, next action, next action date'),
    sheet('Мероприятия','Meetups','meetup_id, group_id, ссылка на событие, ссылка на приём заявок, срок с часовым поясом, формат, расходы и помощь с поездкой, тема и версия доклада, статус, последний контакт, следующее действие, дата следующего действия, права на запись','meetup_id, group_id, event link, call for proposals link, deadline with time zone, format, costs and travel support, talk topic and version, status, last contact, next action, next action date, recording rights'),
  ];
  rows(templates['event-map'][0], [['G001','Kubernetes','Oslo','https://events.example/G001','почта',date,'инженеры','предложите один доклад',next]], [['G001','Kubernetes','Oslo','https://events.example/G001','email',date,'engineers','propose one talk',next]]);
  rows(templates['event-map'][1], [['M001','G001','https://events.example/M001','https://events.example/M001/cfp','2026-12-10 12:00 UTC','митап','', 'Как эксплуатировать кластеры Kubernetes для клиентов на общем железе: изоляция, восстановление и цена','',date,'предложите один доклад',next,'']], [['M001','G001','https://events.example/M001','https://events.example/M001/cfp','2026-12-10 12:00 UTC','meetup','','Operating customer Kubernetes clusters on shared hardware: isolation, recovery and cost','',date,'propose one talk',next,'']]);
  rows(templates['signals-week'][0], [
    ['Issues','установка','P001','пробует','установка падает на одном типе сетевых карт','https://product.example/issues/1'],
    ['Вопросы в чате сообщества','перенести виртуальные машины между кластерами','P002','рабочая среда','как перенести виртуальные машины между кластерами','https://product.example/chat/2'],
    ['Записи звонков продаж','обновления','P003','пробует','покупатели боятся обновлений','https://product.example/calls/3'],
    ['Обращения в поддержку платных клиентов','журнал действий администраторов для регулятора','P004','платит','банку нужен журнал действий администраторов для регулятора','https://product.example/support/4'],
    ['Данные продукта','установка','P005','пробует','учебное событие: установка остановилась на настройке сети; слов пользователя нет','https://product.example/telemetry/5'],
  ], [
    ['Issues','installation','P001','evaluating','Installation fails on one network card model','https://product.example/issues/1'],
    ['Community chat','move VMs between clusters','P002','production','How can I move VMs between clusters?','https://product.example/chat/2'],
    ['Sales call','upgrades','P003','evaluating','Buyers fear upgrades','https://product.example/calls/3'],
    ['Paid support','administrator audit log for the regulator','P004','paying','The bank needs an administrator audit log for the regulator','https://product.example/support/4'],
    ['Product data','installation','P005','evaluating','Synthetic event: installation stopped at network setup; no user quotation','https://product.example/telemetry/5'],
  ]);
  rows(templates['llm-panel'][0], [[date,'MODEL-VERSION','', 'ru','Под какой лицензией распространяется продукт?','1','','','','','','']], [[date,'MODEL-VERSION','','en','What is the license?',1,'','','','','','']]);
  templates['pr-briefing'] = [sheet('Заявка на брифинг','Briefing request','компания, исследование, формат, автор, задача покупателя, модель развёртывания, три конкурента, клиенты, что нового, доказательства','company, research, format, author, buyer problem, deployment model, three competitors, customers, what is new, evidence')];
  rows(templates['pr-briefing'][0], [['Stratova','','','','уходят с VMware','платформа частного облака','','провайдер из Чехии','за год к ней перешли двенадцать европейских хостинг-провайдеров','замеры стоимости кластера на своём оборудовании до и после перехода']], [['Stratova','','','','leaving VMware','private cloud platform','','provider in Czechia','Twelve European hosting providers migrated in a year','Cluster cost measurements on own hardware before and after migration']]);
  templates['pr-news'] = [sheet('Новость','News package','компания, журналист, факт, цифры, кто может об этом рассказать, что журналист может проверить сам, письмо','company, journalist, fact, numbers, independent speaker, verifiable evidence, pitch')];
  rows(templates['pr-news'][0], [['Stratova','Дэн','провайдеры, которые уходят с VMware',12,'провайдер из Брно','Замеры стоимости кластера до и после','Если тема вам интересна, технический директор может ответить на вопросы на этой неделе. Если нет, не отвечайте, я не буду напоминать']], [['Stratova','Dan','Providers leaving VMware',12,'provider in Brno','Cluster costs before and after','If this is of interest, the CTO can answer questions this week. If not, no reply is needed; I will not follow up.']]);
  templates['pr-founder'] = [sheet('Двенадцать тем на год','Founder topics','решение, что из него можно рассказать публично, какие цифры можно показать, три темы, площадки, цель выступления, три факта, о чём говорить нельзя, самый неудобный вопрос из зала, ответ','decision, public material, publishable figures, first three topics, platforms, talk objective, three facts, off limits, hardest audience question, answer')];
  rows(templates['pr-founder'][0], [['решение об архитектуре','разбор стоимости','сколько стоил кластер на своём оборудовании','1','сайт компании или проекта','','','','','']], [['architecture decision','cost breakdown','Cluster cost on own hardware',1,'company or project website','','','','','']]);
}

// Finance examples use $000 throughout, except dates and percentages.
export const financeExample = {
  drivers: [1200, 240, 240, 10, 2, 12, 4, .8, 4, 6, 35, 12, 7, 2, 12, 36, 36, 2, 600],
  weekly: { opening: 500, floor: 150, clients: [30,30,100,30,30,30,30,30,30,30,30,30,30], payroll: [0,100,0,100,0,100,0,100,0,100,0,100,0], hosting: Array(13).fill(20), other: [10,10,10,10,40,10,10,10,10,10,10,10,10] },
};
