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
    [
      [tr('Использовать драйверы: 1 — да, 0 — исходный пример','Use drivers: 1 = yes, 0 = original example'),0],
      [tr('Месяц запуска продукта','Product launch month'),1],
      [tr('Регистрации в месяц','Monthly signups'),100],
      [tr('Конверсия в оплату, доля','Paid conversion, fraction'),0.1],
      [tr('ACV, тыс. $','ACV, $000'),12],
      [tr('Драйверы: новые клиенты платят ACV при регистрации; выручка признаётся за 12 месяцев, продление ежегодно, отток не моделируется.','Drivers: new customers pay ACV at signup; revenue is recognized over 12 months, renewals are annual, churn is not modeled.')],
    ].forEach(row => inputs.addRow(row));
    for (const [row, min, max] of [[21,0,1],[22,1,18]]) inputs.getCell(row,2).dataValidation = {type:'whole',operator:'between',formulae:[min,max],showErrorMessage:true,errorStyle:'stop'};
    inputs.getCell('B18').dataValidation = {type:'whole',operator:'greaterThanOrEqual',formulae:[1],showErrorMessage:true,errorStyle:'stop'};
    inputs.getCell('B24').dataValidation = {type:'decimal',operator:'between',formulae:[0,1],showErrorMessage:true,errorStyle:'stop'};
    for (const row of [23,25]) inputs.getCell(row,2).dataValidation = {type:'decimal',operator:'greaterThanOrEqual',formulae:[0],showErrorMessage:true,errorStyle:'stop'};
    const months = en ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] : ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
    const init = (s, labels, total=true) => { s.addRow([tr('Строка, тыс. $','Line, $000'),...months,...(total?[tr('Год / на конец года','Year / year-end')]:[])]); labels.forEach(l => s.addRow([tr(...l)])); };
    init(pnl,[['Выручка от подписок','Subscriptions'],['Выручка от потребления','Usage'],['Выручка от услуг','Services'],['Выручка всего','Revenue'],['Хостинг для клиентов','Hosting COGS'],['Поддержка','Support COGS'],['Внедрения','Services COGS'],['Себестоимость (COGS)','COGS'],['Валовая прибыль','Gross profit'],['Разработка (R&D)','R&D'],['Продажи и маркетинг (S&M)','S&M'],['Общие расходы со страховкой и амортизацией','G&A including insurance and depreciation'],['Операционные расходы','Operating expenses'],['Операционная прибыль (EBIT)','EBIT'],['Процентный доход','Interest income'],['Чистая прибыль','Net income']]);
    init(cash,[['Поступления от клиентов','Cash from customers'],['Полученные проценты','Interest received'],['Операционные выплаты','Operating payments'],['Деньги от операционной деятельности: прямой метод','CFO: direct'],['Покупка оборудования','CFI'],['Финансирование','CFF'],['Изменение денег','Net cash change'],['Чистая прибыль','Net income'],['Амортизация','Depreciation'],['Изменение дебиторской задолженности, минус','Negative change in AR'],['Изменение расходов будущих периодов, минус','Negative change in prepaids'],['Изменение кредиторской задолженности','Change in AP'],['Изменение начисленных обязательств','Change in accruals'],['Изменение отложенной выручки','Change in deferred revenue'],['Деньги от операционной деятельности: косвенный метод','CFO: indirect']]);
    init(balance,[['Деньги','Cash'],['Дебиторская задолженность','AR'],['Расходы будущих периодов','Prepaid expenses'],['Основные средства за вычетом амортизации','PP&E net'],['Активы','Assets'],['Кредиторская задолженность','AP'],['Начисленные обязательства','Accrued expenses'],['Отложенная выручка','Deferred revenue'],['Обязательства','Liabilities'],['Вложенный капитал','Contributed capital'],['Накопленный убыток','Accumulated deficit'],['Капитал','Equity'],['Активы − обязательства − капитал','Assets − liabilities − equity']]);
    init(checks,[['Баланс: должно быть 0','Balance: must be 0'],['Прямой − косвенный метод: должно быть 0','Direct − indirect CFO: must be 0']],false);
    pnl.getCell('A18').value=tr('Выручка от драйверов','Driver-based revenue');
    for (let m=1;m<=18;m++) {
      const col=m<=12?m+1:m+2, prevCol=m===13?13:col-1;
      const c=pnl.getColumn(col).letter, prev=pnl.getColumn(prevCol).letter;
      if(m>12) for(const sh of [pnl,cash,balance,checks]) sh.getCell(1,col).value=`${months[(m-1)%12]} 2`;
      const H=ref(hiring,hiring.getColumn(m+7).letter,32);
      const hire = role => `SUMIFS('${hiring.name}'!${hiring.getColumn(m+7).letter}2:${hiring.getColumn(m+7).letter}31,'${hiring.name}'!$B$2:$B$31,"${role}")`;
      const P=r=>ref(pnl,c,r), B=r=>ref(balance,c,r), C=r=>ref(cash,c,r), old=(s,r)=>m===1?'0':ref(s,prev,r);
      f(pnl,18,col,`MAX(0,${m}-${inp(22)}+1)*${inp(23)}*${inp(24)}*${inp(25)}/12`);
      const depreciation = `MIN(${inp(17)}/${inp(18)},MAX(0,${inp(17)}-(${m}-1)*${inp(17)}/${inp(18)}))`;
      const receipts = `IF(${inp(21)}=1,IF(${m}>=${inp(22)},${inp(23)}*${inp(24)}*${inp(25)}*(1+IF(${m}>=${inp(22)}+12,1,0)),0),IF(MOD(${m}-1,12)=0,${inp(3)},0)+IF(MOD(${m}-7,12)=0,${inp(4)},0))`;
      const formulas=[`IF(${inp(21)}=1,${c}18,${inp(3)}/12+IF(${m}>=7,${inp(4)}/12,0))`,`IF(${inp(21)}=1,0,${inp(5)}+${inp(6)}*(${m}-1))`,`IF(${inp(21)}=1,0,IF(MOD(${m},3)=0,${inp(7)},0))`,`SUM(${c}2:${c}4)`,`${inp(8)}+${inp(9)}*(${m}-1)`,`${inp(10)}+${hire("COGS")}`,`IF(MOD(${m},3)=0,${inp(11)},0)`,`SUM(${c}6:${c}8)`,`${c}5-${c}9`,`${inp(12)}+${hire("R&D")}`,`${inp(13)}+${hire("S&M")}`,`${inp(14)}+${hire("G&A")}+${inp(16)}/12+${depreciation}+IF(${m}=12,${inp(15)},0)`,`SUM(${c}11:${c}13)`,`${c}10-${c}14`,inp(19),`${c}15+${c}16`];
      formulas.forEach((v,i)=>f(pnl,i+2,col,v));
      [
        `${receipts}+${old(pnl,3)}+${old(pnl,4)}`,
        inp(19),`-(${old(pnl,6)}+${inp(10)}+${P(8)}+${inp(12)}+${H}+${inp(13)}+${inp(14)}+IF(MOD(${m}-1,12)=0,${inp(16)},0)+IF(${m}=13,${inp(15)},0))`,
        `SUM(${c}2:${c}4)`,`IF(${m}=1,-${inp(17)},0)`,`IF(${m}=7,${inp(20)},0)`,`SUM(${c}5:${c}7)`,
        P(17),depreciation,`-(${B(3)}-${old(balance,3)})`,`-(${B(4)}-${old(balance,4)})`,`${B(7)}-${old(balance,7)}`,`${B(8)}-${old(balance,8)}`,`${B(9)}-${old(balance,9)}`,`SUM(${c}9:${c}15)`,
      ].forEach((v,i)=>f(cash,i+2,col,v));
      [
        `${m===1?inp(2):old(balance,2)}+${C(8)}`,`${P(3)}+${P(4)}`,`${inp(16)}*(11-MOD(${m}-1,12))/12`,`MAX(0,${inp(17)}-${m}*${inp(17)}/${inp(18)})`,`SUM(${c}2:${c}5)`,P(6),`IF(${m}=12,${inp(15)},0)`,`${old(balance,9)}+${receipts}-${P(2)}`,`SUM(${c}7:${c}9)`,`${inp(2)}+IF(${m}>=7,${inp(20)},0)`,`${old(balance,12)}+${P(17)}`,`${c}11+${c}12`,`${c}6-${c}10-${c}13`,
      ].forEach((v,i)=>f(balance,i+2,col,v));
      f(checks,2,col,B(14)); f(checks,3,col,`${C(5)}-${C(16)}`);
    }
    for (const s of [pnl,cash,balance]) for(let r=2;r<=s.rowCount;r++) f(s,r,14,s===balance?`M${r}`:`SUM(B${r}:M${r})`);
    const demo=w.addWorksheet(tr('Сверка примера','Demo reconciliation'));
    demo.addRow([tr('Только исходный пример InfraSeed; не проверка вашей модели','Original InfraSeed example only; not a check of your model'),tr('Текущее значение','Current value'),tr('Исходный пример','Original example')]);
    [[tr('Деньги на конец','Ending cash'),ref(balance,'M',2),1704],[tr('Выручка за год','Annual revenue'),ref(pnl,'N',5),660],[tr('Чистая прибыль за год','Annual net income'),ref(pnl,'N',17),-162.8]].forEach(([name,formula,value])=>demo.addRow([name,{formula},value]));
    hiring.addRow([tr('Человек / вакансия','Person / vacancy'),tr('Роль','Role'),tr('Статус','Status'),tr('Месяц начала','Start month'),tr('Полная стоимость в месяц, тыс. $','Monthly loaded cost, $000'),tr('Разовые расходы на найм и оборудование, тыс. $','One-off recruiting and equipment cost, $000'),tr('Примечание','Note'),...Array.from({length:18},(_,i)=>i+1)]);
    const statuses = [tr('В штате','In post'),tr('Оффер','Offer'),tr('Открыта','Open')];
    for (let r=2;r<=31;r++) {
      hiring.getCell(r,2).value='R&D';
      hiring.getCell(r,2).dataValidation={type:'list',allowBlank:false,formulae:['"R&D,S&M,G&A,COGS"'],showErrorMessage:true,errorStyle:'stop'};
      hiring.getCell(r,3).value=statuses[2]; hiring.getCell(r,4).value=1; hiring.getCell(r,5).value=0; hiring.getCell(r,6).value=0;
      hiring.getCell(r,3).dataValidation={type:'list',allowBlank:false,formulae:[`"${statuses.join(',')}"`],showErrorMessage:true,errorStyle:'stop'};
      hiring.getCell(r,4).dataValidation={type:'whole',operator:'between',formulae:[1,18],showErrorMessage:true,errorStyle:'stop'};
      hiring.getCell(r,5).dataValidation={type:'decimal',operator:'greaterThanOrEqual',formulae:[0],showErrorMessage:true,errorStyle:'stop'};
      hiring.getCell(r,6).dataValidation={type:'decimal',operator:'greaterThanOrEqual',formulae:[0],showErrorMessage:true,errorStyle:'stop'};
      for (let m=1;m<=18;m++) f(hiring,r,m+7,`IF($A${r}="",0,IF(${m}>=$D${r},$E${r},0)+IF(${m}=$D${r},$F${r},0))`);
    }
    hiring.getCell('A32').value=tr('Всего: дополнительные расходы на найм','Total: additional hiring costs');
    for (let m=1;m<=18;m++) { const c=hiring.getColumn(m+7).letter; f(hiring,32,m+7,`SUM(${c}2:${c}31)`); }
    hiring.getCell('A34').value=tr('Запишите каждого сотрудника и каждую вакансию: одна строка на человека или вакансию, полная стоимость и статус. Роль задаёт строку расходов: R&D — разработка, S&M — продажи и маркетинг, G&A — общие расходы, COGS — поддержка клиентов. Все статусы входят в план с месяца начала. Исключите эти расходы из базовых допущений, чтобы не считать их дважды.','List every employee and every vacancy: one row per person or vacancy, with loaded cost and status. Role selects the expense line: R&D, S&M, G&A, or COGS (customer support). All statuses enter the plan from the start month. Remove these costs from baseline inputs to avoid counting them twice.');
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
    const scenarios=[tr('Основной','Base'),tr('Лучший','Upside'),tr('Худший','Downside')];
    for(let r=2;r<=301;r++) {
      f(events,r,14,`IF(F${r}="",E${r},F${r})`);
      f(events,r,15,`IF(G${r}="",0,MAX(0,G${r}-L${r}))`);
      events.getCell(r,4).dataValidation={type:'list',allowBlank:true,formulae:[`"${cats.join(',')}"`],showErrorMessage:true,errorStyle:'stop'};
      events.getCell(r,9).dataValidation={type:'list',allowBlank:true,formulae:[`"${scenarios.join(',')}"`],showErrorMessage:true,errorStyle:'stop'};
    }
    const guide=q.addWorksheet(tr('Как заполнять','Instructions'));
    guide.addRow([tr('Заполняйте строки 2–301. Тип и сценарий выбирайте из списка. Для большего числа строк расширьте формулы.','Use rows 2–301. Choose a type and scenario from the list. Extend formulas for more rows.')]);
    guide.addRow([tr('Частичная оплата: план 100, получено 40; остаток 60 остаётся на ожидаемой дате. Факт 40 учитывается на фактической дате.','Partial payment: plan 100, received 40; 60 remains open on the expected date. Actual 40 counts on the actual date.')]);
    weekly.addRow([tr('Неделя, тыс. $','Week, $000'),...Array.from({length:13},(_,i)=>new Date(+start+i*7*86400000))]);
    [tr('На начало','Opening'),...cats,tr('На конец','Closing'),tr('Минимальный запас','Floor'),tr('Запас сверх минимума','Headroom'),tr('Сценарий','Scenario')].forEach(n=>weekly.addRow([n]));
    for(let m=1;m<=13;m++) {
      const c=String.fromCharCode(65+m),prev=String.fromCharCode(64+m), E=`'${events.name}'!`;
      if(m===1) weekly.getCell(2,2).value=financeExample.weekly.opening; else f(weekly,2,m+1,`${prev}7`);
      cats.forEach((_,i)=>f(weekly,i+3,m+1,`SUMIFS(${E}$O$2:$O$301,${E}$N$2:$N$301,">="&${c}$1,${E}$N$2:$N$301,"<"&(${c}$1+7),${E}$D$2:$D$301,$A${i+3},${E}$I$2:$I$301,$B$10)+SUMIFS(${E}$L$2:$L$301,${E}$K$2:$K$301,">="&${c}$1,${E}$K$2:$K$301,"<"&(${c}$1+7),${E}$D$2:$D$301,$A${i+3},${E}$I$2:$I$301,$B$10)`));
      f(weekly,7,m+1,`${c}2+${c}3-SUM(${c}4:${c}6)`);
      if(m===1) weekly.getCell(8,2).value=financeExample.weekly.floor; else f(weekly,8,m+1,'$B$8');
      f(weekly,9,m+1,`${c}7-${c}8`);
    }
    weekly.getCell('B10').value=tr('Основной','Base');
    weekly.getCell('B10').dataValidation={type:'list',formulae:[`"${scenarios.join(',')}"`],showErrorMessage:true,errorStyle:'stop'};
    weekly.addConditionalFormatting({ref:'B9:N9',rules:[{type:'cellIs',operator:'lessThan',formulae:[0],priority:1,style:{fill:{type:'pattern',pattern:'solid',fgColor:{argb:'FFFFCCCC'}},font:{color:{argb:'FF990000'}}}}]});
    style(q); for(const col of [5,6,11,14]) events.getColumn(col).numFmt='yyyy-mm-dd'; for(let c=2;c<=14;c++) weekly.getCell(1,c).numFmt='yyyy-mm-dd';
    events.autoFilter='A1:O1'; await q.xlsx.writeFile(`${output}/cash-13w${en?'-en':''}.xlsx`);
  }
}
