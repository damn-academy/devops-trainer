// Read the generated XLSX, evaluate its formula subset, and compare with the lessons.
// No cached results or generator calculations are used as the source of truth.
import ExcelJS from 'exceljs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const dir = fileURLToPath(new URL('../public/templates/', import.meta.url));
const near = (actual, expected, context) => assert.ok(Math.abs(actual-expected)<1e-7,`${context}: ${actual} != ${expected}`);
function reader(book) {
  const cache = new Map(), active = new Set();
  const cell = (sheet, address) => {
    const key=sheet+'!'+address;
    if(cache.has(key)) return cache.get(key);
    assert.ok(!active.has(key),`Circular formula: ${key}`); active.add(key);
    const v=book.getWorksheet(sheet).getCell(address).value;
    const result=v instanceof Date ? (+v-Date.UTC(1899,11,30))/86400000 : v?.formula ? evaluate(v.formula,sheet) : v ?? '';
    active.delete(key); cache.set(key,result); return result;
  };
  const range = (sheet, from, to) => {
    const s=book.getWorksheet(sheet), a=s.getCell(from), b=s.getCell(to), values=[];
    for(let r=a.row;r<=b.row;r++) for(let c=a.col;c<=b.col;c++) values.push(cell(sheet,s.getCell(r,c).address));
    return values;
  };
  const functions={
    IF:(condition,yes,no)=>condition?yes:no,
    ABS:Math.abs,
    MOD:(a,b)=>((a%b)+b)%b,
    MIN:(...args)=>Math.min(...args.map(Number)),
    MAX:(...args)=>Math.max(...args.map(Number)),
    SUM:(...args)=>args.flat().reduce((a,b)=>a+Number(b),0),
    SUMIFS:(values,...conditions)=>values.reduce((sum,value,i)=> {
      const matches=conditions.every((item,k)=> {
        if(k%2) return true;
        const criterion=conditions[k+1], actual=item[i];
        if(typeof criterion==='string') {
          const match=criterion.match(/^(>=|<=|<>|>|<|=)(.*)$/);
          if(match) { const b=Number(match[2]),a=Number(actual); return ({'>=':a>=b,'<=':a<=b,'<>':a!==b,'>':a>b,'<':a<b,'=':a===b})[match[1]]; }
        }
        return actual===criterion;
      });
      return sum+(matches?Number(value):0);
    },0),
  };
  function evaluate(formula,sheet) {
    const tokens=formula.match(/'(?:[^']|'')+'!\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?|\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?|"[^"]*"|\d+(?:\.\d+)?|[A-Z]+|>=|<=|<>|[+\-*/=><&(),]/g);
    assert.equal(tokens.join(''),formula,`Unsupported formula: ${formula}`);
    let at=0;
    const prec={'=':1,'<>':1,'>':1,'<':1,'>=':1,'<=':1,'&':2,'+':3,'-':3,'*':4,'/':4};
    const apply=(op,a,b)=>({'+':()=>Number(a)+Number(b),'-':()=>a-b,'*':()=>a*b,'/':()=>a/b,'=':()=>a===b,'<>':()=>a!==b,'>':()=>a>b,'<':()=>a<b,'>=':()=>a>=b,'<=':()=>a<=b,'&':()=>String(a)+String(b)})[op]();
    function expr(min=0) {
      let token=tokens[at++], value;
      if(token==='-') value=-expr(5);
      else if(token==='(') { value=expr(); assert.equal(tokens[at++],')'); }
      else if(token.startsWith('"')) value=token.slice(1,-1);
      else if(/^\d/.test(token)) value=Number(token);
      else if(tokens[at]==='(') {
        at++; const args=[];
        while(tokens[at]!==')') { args.push(expr()); if(tokens[at]!==',') break; at++; }
        assert.equal(tokens[at++],')'); assert.ok(functions[token],token); value=functions[token](...args);
      } else {
        let name=sheet, address=token;
        if(token.startsWith("'")) { const split=token.lastIndexOf('!'); name=token.slice(1,split-1).replaceAll("''","'"); address=token.slice(split+1); }
        address=address.replaceAll('$',''); const [a,b]=address.split(':'); value=b?range(name,a,b):cell(name,a);
      }
      while(at<tokens.length && (prec[tokens[at]]??-1)>=min) { const op=tokens[at++]; value=apply(op,value,expr(prec[op]+1)); }
      return value;
    }
    const result=expr(); assert.equal(at,tokens.length,formula); return result;
  }
  return cell;
}
for(const suffix of ['', '-en']) {
  const w=new ExcelJS.Workbook(); await w.xlsx.readFile(`${dir}/infraseed-model${suffix}.xlsx`); const read=reader(w);
  assert.equal(w.worksheets.length,7);
  const [inputs,pnl,cash,balance,checks,hiring]=w.worksheets;
  const ending=[1336,1286,1231.2,1195.6,1149.2,1098,1906,1863.2,1815.6,1787.2,1748,1704];
  const revenues=[30,32,46,36,38,52,62,64,78,68,70,84];
  const net=[-32,-30.8,-23.6,-28.4,-27.2,-20,-4.8,-3.6,3.6,-1.2,0,5.2];
  for(let m=0;m<12;m++) {
    const c=String.fromCharCode(66+m);
    near(read(checks.name,`${c}2`),0,`BS ${m+1}`); near(read(checks.name,`${c}3`),0,`CFO bridge ${m+1}`);
    near(read(balance.name,`${c}2`),ending[m],`cash ${m+1}`);
    near(read(pnl.name,`${c}5`),revenues[m],`revenue ${m+1}`); near(read(pnl.name,`${c}17`),net[m],`income ${m+1}`);
  }
  near(read(balance.name,'O8'),0,'January accountant liability settled');
  near(read(balance.name,'O2'),1905.2,'January cash after accountant payment');
  near(read(cash.name,'O5'),201.2,'January direct CFO after accountant payment');
  near(read(cash.name,'O16'),201.2,'January indirect CFO after accountant payment');
  const demo=w.worksheets[6];
  for(let r=2;r<=4;r++) near(read(demo.name,`B${r}`),read(demo.name,`C${r}`),`demo ${r}`);
  near(read(cash.name,'N5'),-60,'annual CFO');
  for(let m=13;m<=18;m++) { const c=checks.getColumn(m+2).letter; near(read(checks.name,`${c}2`),0,`extended balance ${m}`); near(read(checks.name,`${c}3`),0,`extended CFO ${m}`); }
  const originalLife = inputs.getCell('B18').value;
  for (const life of [originalLife, 6, 18, 24]) {
    inputs.getCell('B18').value=life; const depreciated=reader(w);
    const equipment=inputs.getCell('B17').value;
    for(let m=1;m<=18;m++) {
      const c=checks.getColumn(m<=12?m+1:m+2).letter;
      near(depreciated(balance.name,`${c}5`),Math.max(0,equipment*(1-m/life)),`fixed assets life ${life} month ${m}`);
      near(depreciated(cash.name,`${c}10`),m<=life?equipment/life:0,`depreciation life ${life} month ${m}`);
      near(depreciated(checks.name,`${c}2`),0,`balance life ${life} month ${m}`);
      near(depreciated(checks.name,`${c}3`),0,`CFO life ${life} month ${m}`);
    }
  }
  inputs.getCell('B18').value=originalLife;
  inputs.getCell('B21').value=1;
  const driven=reader(w);
  near(driven(pnl.name,'B5'),10,'first driver revenue');
  near(driven(pnl.name,'M5'),120,'December driver revenue');
  const driverCash=driven(balance.name,'M2');
  for(let m=1;m<=18;m++) { const c=checks.getColumn(m<=12?m+1:m+2).letter; near(driven(checks.name,`${c}2`),0,`driver balance ${m}`); near(driven(checks.name,`${c}3`),0,`driver CFO ${m}`); }
  inputs.getCell('B22').value=4;
  const delayed=reader(w);
  near(delayed(pnl.name,'B5'),0,'no revenue before launch');
  near(delayed(pnl.name,'E5'),10,'first revenue at delayed launch');
  near(delayed(pnl.name,'M5'),90,'delayed December revenue');
  near(delayed(balance.name,'M2'),driverCash-360,'launch shift changes December cash');
  for (const scenario of [driven,delayed]) for(let m=1;m<=18;m++) {
    const c=checks.getColumn(m<=12?m+1:m+2).letter;
    near(scenario(checks.name,`${c}2`),0,`driver balance ${m}`);
    near(scenario(checks.name,`${c}3`),0,`driver CFO ${m}`);
  }
  inputs.getCell('B21').value=0; inputs.getCell('B22').value=1;
  // Each named person/vacancy enters expenses and cash from their own start month.
  for(const [r,start,cost,status] of [[2,7,17.7,0],[3,10,12,1],[4,13,8,2]]) {
    hiring.getCell(r,1).value=`Person ${r}`; hiring.getCell(r,2).value='R&D';
    hiring.getCell(r,3).value=(suffix?['In post','Offer','Open']:['В штате','Оффер','Открыта'])[status];
    hiring.getCell(r,4).value=start; hiring.getCell(r,5).value=cost;
  }
  const hired=reader(w);
  near(hired(pnl.name,'H11')-read(pnl.name,'H11'),17.7,'July hire in R&D');
  near(hired(pnl.name,'Q11')-read(pnl.name,'Q11'),37.7,'all three hires in month 15');
  near(hired(balance.name,'M2'),1704-17.7*6-12*3,'hiring changes cash');
  for(let m=1;m<=18;m++) { const c=checks.getColumn(m<=12?m+1:m+2).letter; near(hired(checks.name,`${c}2`),0,`hired balance ${m}`); near(hired(checks.name,`${c}3`),0,`hired CFO ${m}`); }
  for (const [role, row] of [['R&D',11],['S&M',12],['G&A',13],['COGS',7]]) {
    hiring.getCell('B2').value=role;
    const routed=reader(w);
    for (const line of [7,11,12,13]) near(routed(pnl.name,`H${line}`)-read(pnl.name,`H${line}`),line===row?17.7:0,`${role} routes to ${line}`);
    near(routed(balance.name,'M2'),hired(balance.name,'M2'),`${role} cash unchanged`);
    for(let m=1;m<=18;m++) { const c=checks.getColumn(m<=12?m+1:m+2).letter; near(routed(checks.name,`${c}2`),0,`${role} balance ${m}`); near(routed(checks.name,`${c}3`),0,`${role} CFO ${m}`); }
  }
  for (const [role, row] of [['R&D',11],['S&M',12],['G&A',13],['COGS',7]]) {
    hiring.getCell('B2').value=role;
    const before=reader(w);
    for(let m=1;m<=18;m++) { const c=pnl.getColumn(m<=12?m+1:m+2).letter; for(const line of [7,11,12,13]) before(pnl.name,`${c}${line}`); before(balance.name,`${c}2`); }
    hiring.getCell('F2').value=23;
    const once=reader(w);
    for(let m=1;m<=18;m++) {
      const c=pnl.getColumn(m<=12?m+1:m+2).letter;
      for(const line of [7,11,12,13]) near(once(pnl.name,`${c}${line}`)-before(pnl.name,`${c}${line}`),m===7 && line===row?23:0,`one-off ${role} month ${m} line ${line}`);
      near(once(balance.name,`${c}2`)-before(balance.name,`${c}2`),m>=7?-23:0,`one-off cash ${m}`);
      near(once(checks.name,`${c}2`),0,`one-off balance ${m}`);
      near(once(checks.name,`${c}3`),0,`one-off CFO ${m}`);
    }
    hiring.getCell('D2').value=13;
    const moved=reader(w);
    near(moved(pnl.name,`O${row}`)-read(pnl.name,`O${row}`),role==='R&D'?60.7:40.7,'one-off moved to year two');
    hiring.getCell('D2').value=7; hiring.getCell('F2').value=0;
  }
  // Equipment is an investing payment and asset; only depreciation reaches P&L.
  for (const start of [1, 7, 13, 18]) for (const role of ['R&D','S&M','G&A','COGS']) {
    hiring.getCell('B2').value=role; hiring.getCell('D2').value=start;
    hiring.getCell('F2').value=9; hiring.getCell('G2').value=0;
    const before=reader(w), baseline=[];
    for(let m=1;m<=18;m++) {
      const c=pnl.getColumn(m<=12?m+1:m+2).letter;
      baseline.push([before(pnl.name,`${c}17`),before(balance.name,`${c}2`),before(balance.name,`${c}5`),before(cash.name,`${c}6`),before(cash.name,`${c}5`),before(cash.name,`${c}10`)]);
    }
    hiring.getCell('G2').value=36;
    const equipped=reader(w);
    for(let m=1;m<=18;m++) {
      const c=pnl.getColumn(m<=12?m+1:m+2).letter, active=m>=start, elapsed=active?m-start+1:0;
      const [income,money,assets,cfi,cfo,dep]=baseline[m-1];
      near(equipped(pnl.name,`${c}17`)-income,active?-1:0,`equipment income ${role}/${start}/${m}`);
      near(equipped(balance.name,`${c}2`)-money,active?-36:0,`equipment cash ${m}`);
      near(equipped(balance.name,`${c}5`)-assets,active?36-elapsed:0,`equipment assets ${m}`);
      near(equipped(cash.name,`${c}6`)-cfi,m===start?-36:0,`equipment investing ${m}`);
      near(equipped(cash.name,`${c}5`)-cfo,0,`equipment operating ${m}`);
      near(equipped(cash.name,`${c}10`)-dep,active?1:0,`equipment depreciation ${m}`);
      near(equipped(checks.name,`${c}2`),0,`equipment balance ${m}`);
      near(equipped(checks.name,`${c}3`),0,`equipment CFO ${m}`);
    }
    hiring.getCell('G2').value=0; hiring.getCell('F2').value=0;
  }
  hiring.getCell('B2').value='R&D';
  hiring.getCell('D2').value=10; hiring.getCell('D3').value=13;
  near(reader(w)(balance.name,'M2')-hired(balance.name,'M2'),3*(17.7+12),'delaying two hires');
  for(let r=2;r<=4;r++) hiring.getCell(r,1).value=null;
  // Prove live input dependencies: more cash changes cash and equity equally.
  inputs.getCell('B2').value=1300; const changed=reader(w); near(changed(balance.name,'M2'),1804,'changed opening cash'); near(changed(checks.name,'M2'),0,'changed balance check');
  inputs.getCell('B2').value=750; const own=reader(w);
  for(let m=1;m<=18;m++) { const c=checks.getColumn(m<=12?m+1:m+2).letter; near(own(checks.name,`${c}2`),0,`own opening balance ${m}`); near(own(checks.name,`${c}3`),0,`own CFO ${m}`); }
  assert.equal(checks.getCell('D5').value,null);
  // Split full per-person amounts, including one-off costs, without doubling cash.
  const splitBook=new ExcelJS.Workbook();
  await splitBook.xlsx.readFile(`${dir}/infraseed-model${suffix}.xlsx`);
  const [,sp,sc,sb,ck,sh]=splitBook.worksheets;
  assert.equal(sh.getCell('H1').value,suffix?'Share of cost, %':'Доля в строке, %');
  for(let r=2;r<=31;r++) {
    assert.equal(sh.getCell(r,8).value,100);
    assert.deepEqual(sh.getCell(r,8).dataValidation.formulae,[0,100]);
    assert.equal(sh.getCell(r,8).dataValidation.errorStyle,'stop');
  }
  assert.ok(sh.conditionalFormattings.some(rule=>rule.ref==='I2:I31'));
  assert.ok(ck.conditionalFormattings.some(rule=>rule.ref==='B5:C5'));
  assert.equal(reader(splitBook)(ck.name,'C5'),'OK','blank rows do not trigger warning');
  const base=reader(splitBook), baseMonths=[];
  for(let m=1;m<=18;m++) {
    const c=sp.getColumn(m<=12?m+1:m+2).letter;
    baseMonths.push([7,11,17].map(r=>base(sp.name,`${c}${r}`)).concat([base(sb.name,`${c}2`),base(sb.name,`${c}5`),base(sc.name,`${c}6`)]));
  }
  for(const start of [1,7,13,18]) {
    for(const [r,role,share] of [[2,'COGS',60],[31,'R&D',40]]) {
      sh.getCell(r,1).value='Engineer *?'; sh.getCell(r,2).value=role;
      sh.getCell(r,4).value=start; sh.getCell(r,5).value=20;
      sh.getCell(r,6).value=9; sh.getCell(r,7).value=36; sh.getCell(r,8).value=share;
    }
    const split=reader(splitBook);
    near(split(sh.name,'I2'),100,'same person total');
    near(split(sh.name,'I31'),100,'last row included');
    near(split(ck.name,'B5'),0,'valid split');
    assert.equal(split(ck.name,'C5'),'OK');
    for(let m=1;m<=18;m++) {
      const c=sp.getColumn(m<=12?m+1:m+2).letter;
      const elapsed=Math.max(0,m-start+1), cost=(elapsed?20:0)+(m===start?9:0);
      const [cogs,rd,income,money,assets,cfi]=baseMonths[m-1];
      near(split(sp.name,`${c}7`)-cogs,cost*0.6,`split COGS ${start}/${m}`);
      near(split(sp.name,`${c}11`)-rd,cost*0.4,`split R&D ${start}/${m}`);
      near(split(sp.name,`${c}17`)-income,-cost-(elapsed?1:0),`split income ${start}/${m}`);
      near(split(sb.name,`${c}2`)-money,-20*elapsed-(elapsed?45:0),`split cash ${start}/${m}`);
      near(split(sb.name,`${c}5`)-assets,elapsed?36-elapsed:0,`split assets ${start}/${m}`);
      near(split(sc.name,`${c}6`)-cfi,m===start?-36:0,`split CFI ${start}/${m}`);
      near(split(ck.name,`${c}2`),0,`split balance ${start}/${m}`);
      near(split(ck.name,`${c}3`),0,`split CFO ${start}/${m}`);
    }
  }
  for(const [a,b] of [[0,0],[60,20],[60,60],[100,100]]) {
    sh.getCell('H2').value=a; sh.getCell('H31').value=b;
    const invalid=reader(splitBook);
    near(invalid(ck.name,'B5'),2,'both invalid rows flagged');
    assert.match(invalid(ck.name,'C5'),suffix?/Warning/:/Внимание/);
  }
  sh.getCell('H2').value=33.3333333; sh.getCell('H31').value=66.6666667;
  near(reader(splitBook)(ck.name,'B5'),0,'decimal shares accepted');
  sh.getCell('A31').value='Different engineer';
  near(reader(splitBook)(ck.name,'B5'),2,'different people checked separately');
  sh.getCell('H2').value=100; sh.getCell('H31').value=100;
  near(reader(splitBook)(ck.name,'B5'),0,'separate full-time people accepted');
  const q=new ExcelJS.Workbook(); await q.xlsx.readFile(`${dir}/cash-13w${suffix}.xlsx`); const [events,weekly]=q.worksheets, weeklyRead=reader(q);
  const expected=[500,400,470,370,340,240,240,140,140,40,40,-60,-60];
  expected.forEach((v,i)=>near(weeklyRead(weekly.name,`${String.fromCharCode(66+i)}7`),v,`week ${i+1}`));
  near(weeklyRead(weekly.name,'I9'),-10,'week 8 headroom'); assert.ok(weekly.conditionalFormattings.length);
  assert.ok(weekly.getCell('B3').formula.startsWith('SUMIFS('));
  // Moving a receipt updates both affected weeks without editing formulas.
  const row=events.getRows(2,events.rowCount-1).find(r=>r.getCell(7).value===100 && r.getCell(4).value===weekly.getCell('A3').value);
  row.getCell(6).value=new Date(+row.getCell(6).value+21*86400000); const moved=reader(q);
  near(moved(weekly.name,'D7'),370,'delayed week 3 receipt'); near(moved(weekly.name,'G7'),240,'received in week 6');
  // A newly entered event needs no copied formulas, for every type and scenario.
  const fresh=new ExcelJS.Workbook(); await fresh.xlsx.readFile(`${dir}/cash-13w${suffix}.xlsx`);
  const [e,ws]=fresh.worksheets;
  const rowNumber=47;
  const scenarios=suffix?['Base','Upside','Downside']:['Основной','Лучший','Худший'];
  for(const scenario of scenarios) for(let type=0;type<4;type++) {
    ws.getCell('B10').value=scenario;
    e.getCell(rowNumber,7).value=null; const before=reader(fresh)(ws.name,'B7');
    e.getCell(rowNumber,4).value=ws.getCell(type+3,1).value;
    e.getCell(rowNumber,6).value=new Date('2026-11-30T00:00:00Z');
    e.getCell(rowNumber,7).value=50; e.getCell(rowNumber,9).value=scenario;
    near(reader(fresh)(ws.name,'B7'),before+(type===0?50:-50),`new event ${scenario}/${type}`);
  }
  e.getCell(rowNumber,4).value=ws.getCell('A3').value;
  e.getCell(rowNumber,7).value=100; e.getCell(rowNumber,12).value=40;
  e.getCell(rowNumber,11).value=new Date('2026-11-30T00:00:00Z');
  e.getCell(rowNumber,6).value=new Date('2026-12-07T00:00:00Z');
  const partial=reader(fresh);
  near(partial(e.name,`O${rowNumber}`),60,'partial remains open');
  near(partial(ws.name,'B3'),40,'actual payment in week 1');
  near(partial(ws.name,'C3'),60,'remaining payment in week 2');
  assert.ok(e.getCell('N301').formula && e.getCell('O301').formula);
  console.log(`${suffix||'RU'}: formulas evaluated; 18 balanced months, matching CFO; hiring and opening-cash changes reconcile; all 13 weekly balances, new events and partial receipts match.`);
}
