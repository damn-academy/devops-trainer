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
    MOD:(a,b)=>((a%b)+b)%b,
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
  const demo=w.worksheets[6];
  for(let r=2;r<=4;r++) near(read(demo.name,`B${r}`),read(demo.name,`C${r}`),`demo ${r}`);
  near(read(cash.name,'N5'),-60,'annual CFO');
  for(let m=13;m<=18;m++) { const c=checks.getColumn(m+2).letter; near(read(checks.name,`${c}2`),0,`extended balance ${m}`); near(read(checks.name,`${c}3`),0,`extended CFO ${m}`); }
  // Each named person/vacancy enters expenses and cash from their own start month.
  for(const [r,start,cost,status] of [[2,7,17.7,0],[3,10,12,1],[4,13,8,2]]) {
    hiring.getCell(r,1).value=`Person ${r}`; hiring.getCell(r,2).value='Engineer';
    hiring.getCell(r,3).value=(suffix?['In post','Offer','Open']:['В штате','Оффер','Открыта'])[status];
    hiring.getCell(r,4).value=start; hiring.getCell(r,5).value=cost;
  }
  const hired=reader(w);
  near(hired(pnl.name,'H11')-read(pnl.name,'H11'),17.7,'July hire in R&D');
  near(hired(pnl.name,'Q11')-read(pnl.name,'Q11'),37.7,'all three hires in month 15');
  near(hired(balance.name,'M2'),1704-17.7*6-12*3,'hiring changes cash');
  for(let m=1;m<=18;m++) { const c=checks.getColumn(m<=12?m+1:m+2).letter; near(hired(checks.name,`${c}2`),0,`hired balance ${m}`); near(hired(checks.name,`${c}3`),0,`hired CFO ${m}`); }
  hiring.getCell('D2').value=10; hiring.getCell('D3').value=13;
  near(reader(w)(balance.name,'M2')-hired(balance.name,'M2'),3*(17.7+12),'delaying two hires');
  for(let r=2;r<=4;r++) hiring.getCell(r,1).value=null;
  // Prove live input dependencies: more cash changes cash and equity equally.
  inputs.getCell('B2').value=1300; const changed=reader(w); near(changed(balance.name,'M2'),1804,'changed opening cash'); near(changed(checks.name,'M2'),0,'changed balance check');
  inputs.getCell('B2').value=750; const own=reader(w);
  for(let m=1;m<=18;m++) { const c=checks.getColumn(m<=12?m+1:m+2).letter; near(own(checks.name,`${c}2`),0,`own opening balance ${m}`); near(own(checks.name,`${c}3`),0,`own CFO ${m}`); }
  assert.equal(checks.getCell('D5').value,null);
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
