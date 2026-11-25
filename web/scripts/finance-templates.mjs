import ExcelJS from 'exceljs';
import { financeExample } from './template-examples.mjs';

export async function buildFinanceTemplates(output) {
  for (const en of [false, true]) {
    const tr = (ru, english) => en ? english : ru;
    const wb = () => { const w = new ExcelJS.Workbook(); w.creator = 'damn.academy'; w.created = w.modified = new Date('2026-01-01T00:00:00Z'); w.calcProperties.fullCalcOnLoad = true; return w; };
    const style = w => w.worksheets.forEach(s => { s.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }]; s.getRow(1).font = { bold: true }; s.columns.forEach((c,i) => { c.width = i ? 18 : 42; }); s.eachRow(r => r.eachCell(c => { c.alignment = { wrapText: true }; if (c.type === ExcelJS.ValueType.Formula || c.type === ExcelJS.ValueType.Number) c.numFmt = '0.00;[Red]-0.00'; })); });
    const f = (s, row, col, formula) => { s.getCell(row,col).value = { formula }; };
    const w = wb();
    const names = ['Inputs','PnL','Cash','Balance','Checks','Hiring'].map((s,i) => en ? s : ['Допущения','Прибыли и убытки','Движение денег','Баланс','Проверки','Найм'][i]);
    const [inputs,pnl,cash,balance,checks,hiring] = names.map(n => w.addWorksheet(n));
    const ref = (s,c,r) => `'${s.name}'!${c}${r}`;
    const inp = r => ref(inputs,'$B$',r);
    const driverLabels = [
      ['Деньги и капитал на начало','Opening cash and capital'],['Годовая подписка A','Annual subscription A'],['Годовая подписка B','Annual subscription B'],['Потребление: январь','Usage: January'],['Потребление: рост в месяц','Usage: monthly growth'],['Внедрение: выручка','Implementation revenue'],['Хостинг: январь','Hosting: January'],['Хостинг: рост в месяц','Hosting: monthly growth'],['Поддержка в месяц','Monthly support'],['Подрядчик внедрения','Implementation contractor'],['Разработка в месяц','Monthly R&D'],['Продажи и маркетинг в месяц','Monthly S&M'],['Общие расходы в месяц','Monthly G&A'],['Начисление услуг бухгалтера в декабре','December accountant accrual'],['Страховка за год','Annual insurance'],['Оборудование','Equipment'],['Срок службы, месяцев','Useful life, months'],['Процентный доход в месяц','Monthly interest income'],['Вклад инвесторов в июле','July equity financing'],
    ];
    inputs.addRow([tr('Драйвер, тыс. $','Driver, $000'),tr('Значение','Value')]);
    driverLabels.forEach((l,i) => inputs.addRow([tr(...l),financeExample.drivers[i]]));
    const months = en ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] : ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
    const init = (s, labels, total=true) => { s.addRow([tr('Строка, тыс. $','Line, $000'),...months,...(total?[tr('Год / на конец года','Year / year-end')]:[])]); labels.forEach(l => s.addRow([tr(...l)])); };
    init(pnl,[['Выручка от подписок','Subscriptions'],['Выручка от потребления','Usage'],['Выручка от услуг','Services'],['Выручка всего','Revenue'],['Хостинг для клиентов','Hosting COGS'],['Поддержка','Support COGS'],['Внедрения','Services COGS'],['Себестоимость (COGS)','COGS'],['Валовая прибыль','Gross profit'],['Разработка (R&D)','R&D'],['Продажи и маркетинг (S&M)','S&M'],['Общие расходы со страховкой и амортизацией','G&A including insurance and depreciation'],['Операционные расходы','Operating expenses'],['Операционная прибыль (EBIT)','EBIT'],['Процентный доход','Interest income'],['Чистая прибыль','Net income']]);
    init(cash,[['Поступления от клиентов','Cash from customers'],['Полученные проценты','Interest received'],['Операционные выплаты','Operating payments'],['Деньги от операционной деятельности: прямой метод','CFO: direct'],['Покупка оборудования','CFI'],['Финансирование','CFF'],['Изменение денег','Net cash change'],['Чистая прибыль','Net income'],['Амортизация','Depreciation'],['Изменение дебиторской задолженности, минус','Negative change in AR'],['Изменение расходов будущих периодов, минус','Negative change in prepaids'],['Изменение кредиторской задолженности','Change in AP'],['Изменение начисленных обязательств','Change in accruals'],['Изменение отложенной выручки','Change in deferred revenue'],['Деньги от операционной деятельности: косвенный метод','CFO: indirect']]);
    init(balance,[['Деньги','Cash'],['Дебиторская задолженность','AR'],['Расходы будущих периодов','Prepaid expenses'],['Основные средства за вычетом амортизации','PP&E net'],['Активы','Assets'],['Кредиторская задолженность','AP'],['Начисленные обязательства','Accrued expenses'],['Отложенная выручка','Deferred revenue'],['Обязательства','Liabilities'],['Вложенный капитал','Contributed capital'],['Накопленный убыток','Accumulated deficit'],['Капитал','Equity'],['Активы − обязательства − капитал','Assets − liabilities − equity']]);
    init(checks,[['Баланс: должно быть 0','Balance: must be 0'],['Прямой − косвенный метод: должно быть 0','Direct − indirect CFO: must be 0']],false);
    for (let m=1;m<=12;m++) {
      const c=String.fromCharCode(65+m), prev=String.fromCharCode(64+m);
      const P=r=>ref(pnl,c,r), B=r=>ref(balance,c,r), C=r=>ref(cash,c,r), old=(s,r)=>m===1?'0':ref(s,prev,r);
      const formulas=[`${inp(3)}/12+IF(${m}>=7,${inp(4)}/12,0)`,`${inp(5)}+${inp(6)}*(${m}-1)`,`IF(MOD(${m},3)=0,${inp(7)},0)`,`SUM(${c}2:${c}4)`,`${inp(8)}+${inp(9)}*(${m}-1)`,inp(10),`IF(MOD(${m},3)=0,${inp(11)},0)`,`SUM(${c}6:${c}8)`,`${c}5-${c}9`,inp(12),inp(13),`${inp(14)}+${inp(16)}/12+${inp(17)}/${inp(18)}+IF(${m}=12,${inp(15)},0)`,`SUM(${c}11:${c}13)`,`${c}10-${c}14`,inp(19),`${c}15+${c}16`];
      formulas.forEach((v,i)=>f(pnl,i+2,m+1,v));
      [
        `IF(${m}=1,${inp(3)},0)+IF(${m}=7,${inp(4)},0)+${old(pnl,3)}+${old(pnl,4)}`,
        inp(19),`-(${old(pnl,6)}+${P(7)}+${P(8)}+${inp(12)}+${inp(13)}+${inp(14)}+IF(${m}=1,${inp(16)},0))`,
        `SUM(${c}2:${c}4)`,`IF(${m}=1,-${inp(17)},0)`,`IF(${m}=7,${inp(20)},0)`,`SUM(${c}5:${c}7)`,
        P(17),`${inp(17)}/${inp(18)}`,`-(${B(3)}-${old(balance,3)})`,`-(${B(4)}-${old(balance,4)})`,`${B(7)}-${old(balance,7)}`,`${B(8)}-${old(balance,8)}`,`${B(9)}-${old(balance,9)}`,`SUM(${c}9:${c}15)`,
      ].forEach((v,i)=>f(cash,i+2,m+1,v));
      [
        `${m===1?inp(2):old(balance,2)}+${C(8)}`,`${P(3)}+${P(4)}`,`${inp(16)}*(12-${m})/12`,`${inp(17)}-${m}*${inp(17)}/${inp(18)}`,`SUM(${c}2:${c}5)`,P(6),`IF(${m}=12,${inp(15)},0)`,`${old(balance,9)}+IF(${m}=1,${inp(3)},0)+IF(${m}=7,${inp(4)},0)-${P(2)}`,`SUM(${c}7:${c}9)`,`${inp(2)}+IF(${m}>=7,${inp(20)},0)`,`${old(balance,12)}+${P(17)}`,`${c}11+${c}12`,`${c}6-${c}10-${c}13`,
      ].forEach((v,i)=>f(balance,i+2,m+1,v));
      f(checks,2,m+1,B(14)); f(checks,3,m+1,`${C(5)}-${C(16)}`);
    }
    for (const s of [pnl,cash,balance]) for(let r=2;r<=s.rowCount;r++) f(s,r,14,s===balance?`M${r}`:`SUM(B${r}:M${r})`);
    checks.addRow([tr('Показатель','Metric'),tr('Факт','Actual'),tr('Ожидается','Expected'),tr('Разница: 0','Difference: 0')]);
    [[tr('Деньги на конец','Ending cash'),ref(balance,'M',2),1704],[tr('Выручка за год','Annual revenue'),ref(pnl,'N',5),660],[tr('Чистая прибыль за год','Annual net income'),ref(pnl,'N',17),-162.8]].forEach(([name,formula,value],i)=>{checks.addRow([name,{formula},value,{formula:`B${5+i}-C${5+i}`}]);});
    hiring.addRow([tr('Найм: тыс. $, ставка в долях','Hiring: $000, rate as fraction'),tr('Значение','Value')]);
    [[tr('Годовая зарплата','Annual salary'),180],[tr('Налоги работодателя: оценка','Employer tax estimate'),.08],[tr('Страховки за год','Annual benefits'),18],[tr('Рекрутер','Recruiter'),20],[tr('Оборудование','Equipment'),3],[tr('Месяц начала','Start month'),7],[tr('Полная стоимость в месяц','Monthly loaded cost'),{formula:'B2/12*(1+B3)+B4/12'}],[tr('Стоимость до конца года','Cost through year-end'),{formula:'(13-B7)*B8+B5+B6'}],[tr('Экономия: два найма на три месяца позже','Savings: two hires delayed three months'),{formula:'2*3*B8'}]].forEach(r=>hiring.addRow(r));
    style(w); await w.xlsx.writeFile(`${output}/infraseed-model${en?'-en':''}.xlsx`);

    const q=wb(), events=q.addWorksheet(tr('События','Events')), weekly=q.addWorksheet(tr('Недели','Weekly'));
    events.addRow((en?'Bank|Currency|Counterparty|Type|Original date|Latest expected date|Amount, $000|Confidence|Scenario|Owner|Actual date|Actual amount|Document|Effective date|Effective amount':'Банк|Валюта|Контрагент|Тип|Исходная дата|Последняя ожидаемая дата|Сумма, тыс. $|Уверенность|Сценарий|Ответственный|Фактическая дата|Фактическая сумма|Документ|Дата для прогноза|Сумма для прогноза').split('|'));
    const cats=[tr('Клиенты','Clients'),tr('Зарплата','Payroll'),tr('Хостинг','Hosting'),tr('Прочие','Other')];
    const start= new Date('2026-11-30T00:00:00Z');
    for(let i=0;i<13;i++) for(const [k,key] of ['clients','payroll','hosting','other'].entries()) {
      const d=new Date(+start+i*7*86400000), amount=financeExample.weekly[key][i]; if(!amount) continue;
      const r=events.rowCount+1;
      events.addRow([tr('Основной банк','Main bank'),'USD',cats[k],cats[k],d,d,amount,1,tr('Основной','Base'),tr('Финансы','Finance'),null,null,`example-${i+1}-${key}`,{formula:`IF(K${r}="",F${r},K${r})`},{formula:`IF(L${r}="",G${r},L${r})`}]);
    }
    weekly.addRow([tr('Неделя, тыс. $','Week, $000'),...Array.from({length:13},(_,i)=>new Date(+start+i*7*86400000))]);
    [tr('На начало','Opening'),...cats,tr('На конец','Closing'),tr('Минимальный запас','Floor'),tr('Запас сверх минимума','Headroom'),tr('Сценарий','Scenario')].forEach(n=>weekly.addRow([n]));
    for(let m=1;m<=13;m++) {
      const c=String.fromCharCode(65+m),prev=String.fromCharCode(64+m), E=`'${events.name}'!`;
      if(m===1) weekly.getCell(2,2).value=financeExample.weekly.opening; else f(weekly,2,m+1,`${prev}7`);
      cats.forEach((_,i)=>f(weekly,i+3,m+1,`SUMIFS(${E}$O$2:$O$1001,${E}$N$2:$N$1001,">="&${c}$1,${E}$N$2:$N$1001,"<"&(${c}$1+7),${E}$D$2:$D$1001,$A${i+3},${E}$I$2:$I$1001,$B$10)`));
      f(weekly,7,m+1,`${c}2+${c}3-SUM(${c}4:${c}6)`);
      if(m===1) weekly.getCell(8,2).value=financeExample.weekly.floor; else f(weekly,8,m+1,'$B$8');
      f(weekly,9,m+1,`${c}7-${c}8`);
    }
    weekly.getCell('B10').value=tr('Основной','Base');
    weekly.addConditionalFormatting({ref:'B9:N9',rules:[{type:'cellIs',operator:'lessThan',formulae:[0],priority:1,style:{fill:{type:'pattern',pattern:'solid',fgColor:{argb:'FFFFCCCC'}},font:{color:{argb:'FF990000'}}}}]});
    style(q); for(const col of [5,6,11,14]) events.getColumn(col).numFmt='yyyy-mm-dd'; for(let c=2;c<=14;c++) weekly.getCell(1,c).numFmt='yyyy-mm-dd';
    events.autoFilter='A1:O1'; await q.xlsx.writeFile(`${output}/cash-13w${en?'-en':''}.xlsx`);
  }
}
