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
    MOD:(a,b)=>a%b,
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
  assert.equal(w.worksheets.length,6);
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
  for(let r=5;r<=7;r++) near(read(checks.name,`D${r}`),0,`annual check ${r}`);
  near(read(cash.name,'N5'),-60,'annual CFO'); near(read(hiring.name,'B8'),17.7,'loaded monthly'); near(read(hiring.name,'B9'),129.2,'July hire'); near(read(hiring.name,'B10'),106.2,'delayed hires');
  // Prove live input dependencies: more cash changes cash and equity equally.
  inputs.getCell('B2').value=1300; const changed=reader(w); near(changed(balance.name,'M2'),1804,'changed opening cash'); near(changed(checks.name,'M2'),0,'changed balance check');
  const q=new ExcelJS.Workbook(); await q.xlsx.readFile(`${dir}/cash-13w${suffix}.xlsx`); const [events,weekly]=q.worksheets, weeklyRead=reader(q);
  const expected=[500,400,470,370,340,240,240,140,140,40,40,-60,-60];
  expected.forEach((v,i)=>near(weeklyRead(weekly.name,`${String.fromCharCode(66+i)}7`),v,`week ${i+1}`));
  near(weeklyRead(weekly.name,'I9'),-10,'week 8 headroom'); assert.ok(weekly.conditionalFormattings.length);
  assert.ok(weekly.getCell('B3').formula.startsWith('SUMIFS('));
  // Moving a receipt updates both affected weeks without editing formulas.
  const row=events.getRows(2,events.rowCount-1).find(r=>r.getCell(7).value===100 && r.getCell(4).value===weekly.getCell('A3').value);
  row.getCell(6).value=new Date(+row.getCell(6).value+21*86400000); const moved=reader(q);
  near(moved(weekly.name,'D7'),370,'delayed week 3 receipt'); near(moved(weekly.name,'G7'),240,'received in week 6');
  console.log(`${suffix||'RU'}: formulas evaluated; 12 balanced months, matching CFO, cash 1704, revenue 660, income -162.8; all 13 weekly balances match.`);
}
