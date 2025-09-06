'use strict';
self.window = undefined;
self.document = undefined;
self.fetch = undefined;
self.XMLHttpRequest = undefined;
self.WebSocket = undefined;
self.importScripts = undefined;
self.Worker = undefined;
self.SharedWorker = undefined;
self.EventSource = undefined;
// エラー行逆引き用に直近の生成JSを保持
let __LAST_JS = '';

// ======== 言語サポート ========
// 日本語および英語のデータ型同義語をまとめるマップ
// キーは小文字化した文字列で比較し、値は日本語の正規名称です。
// データ型および配列型の同義語をまとめるマップ。
// キーは小文字化し、複数単語の場合はスペース区切りで登録する。
// 配列や列（英語: array/list、日本語: 列）の型指定では、
// 本質的な基底型に解釈して処理するため、ここでは全て基底型に揃える。
let __LINE_MAP = [];
const TYPE_SYNONYMS = {
  // 基本型（日本語）
  '整数型': '整数型',
  '実数型': '実数型',
  '文字列型': '文字列型',
  '真偽値': '真偽値',
  // 基本型（英語）
  'int': '整数型',
  'integer': '整数型',
  'float': '実数型',
  'real': '実数型',
  'double': '実数型',
  'string': '文字列型',
  'str': '文字列型',
  'char': '文字列型',
  'bool': '真偽値',
  'boolean': '真偽値',
  // 配列／リスト型（英語）
  'int array': '整数型',
  'integer array': '整数型',
  'int list': '整数型',
  'integer list': '整数型',
  'float array': '実数型',
  'real array': '実数型',
  'double array': '実数型',
  'float list': '実数型',
  'real list': '実数型',
  'double list': '実数型',
  'string array': '文字列型',
  'string list': '文字列型',
  'str array': '文字列型',
  'str list': '文字列型',
  'char array': '文字列型',
  'char list': '文字列型',
  'bool array': '真偽値',
  'boolean array': '真偽値',
  'bool list': '真偽値',
  'boolean list': '真偽値',
  // 配列／列型（日本語）
  '整数列': '整数型',
  '実数列': '実数型',
  '文字列列': '文字列型',
  '真偽値列': '真偽値'
};

// JSの行番号(1-based) → 擬似コード行番号 への安全な逆引き
function __jsLineToPseudo(jsLine){
  // まずはマップで逆引き
  const map = __LINE_MAP;
  if (map && Number.isInteger(jsLine) && jsLine >= 1 && jsLine <= map.length) {
    const v = map[jsLine - 1];
    if (v != null) return v|0;
  }
  // フォールバック: 生成JSを遡って直近の __mark(N) を拾う
  const js = __LAST_JS || '';
  if (!js) return 0;
  const lines = js.split('\n');
  const upto = Math.min(jsLine, lines.length);
  let last = 0;
  for (let i = 0; i < upto; i++) {
    const m = lines[i].match(/__mark\((\d+)\);/);
    if (m) last = parseInt(m[1], 10) || 0;
  }
  return last;
}



    // ========= ランタイム =========
    let __LINE__ = 0; let __SRC_LINES = [];
    function __mark(n){ __LINE__ = n|0; }
  
    // 入出力
    let inputTokens = [];
function resetInput(tokens){ inputTokens = (tokens || []).slice(); }
    function nextToken(){ if(inputTokens.length===0) throw new Error('入力が不足しています（Input underflow）'); return inputTokens.shift(); }
  
    // 型/レコード
    const types = Object.create(null), recordDefs = Object.create(null);
    function __出力(){ const parts = Array.from(arguments).map(v=>String(v)); self.postMessage({type:'print', text: parts.join(' ')}); }
    function __改行(){ self.postMessage({type:'print', text: ''}); }
    function castByType(name, token){
      const t=types[name]||'string';
      if(t==='int'){ const v=parseInt(token,10); if(Number.isNaN(v)) throw new Error(`整数型 ${name} に数値以外: ${token}`); return v; }
      if(t==='float'){ const v=parseFloat(token); if(Number.isNaN(v)) throw new Error(`実数型 ${name} に数値以外: ${token}`); return v; }
      if(t==='bool'){ return (token==='1'||token.toLowerCase()==='true'||token==='真'); }
      return token;
    }
    function __read(names){ const out=[]; for(const nm of names){ out.push(castByType(nm,nextToken())); } return out; }
    function __new(typeName){
      const def=recordDefs[typeName]; const obj={__type:typeName};
      if(def){ for(const [fname,fkind] of Object.entries(def.fields)){
        if(fkind==='int'||fkind==='float') obj[fname]=0;
        else if(fkind==='bool') obj[fname]=false;
        else if(fkind==='string') obj[fname]="";
        else if(fkind.startsWith('ptr:')) obj[fname]=null;
        else obj[fname]=null;
      } }
      return obj;
    }
  
    // ========= 正規化/式変換 =========
    function normalize(src){
      return src.replace(/^\uFEFF/,'').replace(/\r/g,'')
        .replace(/[（]/g,'(').replace(/[）]/g,')')
        .replace(/[，]/g,',').replace(/[；]/g,';').replace(/[：]/g,':')
        .replace(/[＜]/g,'<').replace(/[＞]/g,'>')
        .replace(/[≦]/g,'<=').replace(/[≧]/g,'>=').replace(/[≠]/g,'!=').replace(/[＝]/g,'==')
        .replace(/[＋]/g,'+').replace(/[－]/g,'-').replace(/[×＊]/g,'*').replace(/[÷／]/g,'/')
        .replace(/[「]/g,'"').replace(/[」]/g,'"')
        .replace(/[　]/g,' ').replace(/\t/g,'  ').replace(/[\u00A0]/g,' ')
        .replace(/\s+$/gm,'');
    }
    function convertExpr(expr){
      return expr
        // プレースホルダで "真偽値" を保護
        .replace(/真偽値/g,'__TOKEN_BOOLTYPE__')
        // 日本語の論理演算子
        .replace(/かつ/g,'&&')
        .replace(/または/g,'||')
        // 英語の論理演算子（単語境界）
        .replace(/(^|[^A-Za-z0-9_])and($|[^A-Za-z0-9_])/gi,'$1&&$2')
        .replace(/(^|[^A-Za-z0-9_])or($|[^A-Za-z0-9_])/gi,'$1||$2')
        // 日本語の真偽値リテラル
        .replace(/(^|[^A-Za-z0-9_\u3040-\u30ff\u4e00-\u9faf])真($|[^A-Za-z0-9_\u3040-\u30ff\u4e00-\u9faf])/g,'$1true$2')
        .replace(/(^|[^A-Za-z0-9_\u3040-\u30ff\u4e00-\u9faf])偽($|[^A-Za-z0-9_\u3040-\u30ff\u4e00-\u9faf])/g,'$1false$2')
        // 英語の真偽値リテラル
        .replace(/\bTRUE\b/gi,'true')
        .replace(/\bFALSE\b/gi,'false')
        // NIL/nil を null に
        .replace(/\bNIL\b/gi,'null')
        // 日本語の新規生成 "新規 T"
        .replace(/新規\s*([A-Za-z_][A-Za-z0-9_]*)/g,(_,t)=>`__new("${t}")`)
        // 英語の新規生成 "new T"
        .replace(/\bnew\s+([A-Za-z_][A-Za-z0-9_]*)/gi,(_,t)=>`__new("${t}")`)
        // 保護していた "真偽値" を戻す
        .replace(/__TOKEN_BOOLTYPE__/g,'真偽値');
    }
  
    // ========= コンパイラ（JS行→擬似行マップ付） =========
    function compile(src){
      // クリア
      Object.keys(types).forEach(k=>delete types[k]);
      Object.keys(recordDefs).forEach(k=>delete recordDefs[k]);
  
      const norm=normalize(src);
      __SRC_LINES = norm.split(/\n/);
      const lines = __SRC_LINES;
  
      const out = [];               // 生成JS（行ごと）
      const map = [];               // JS行 → 擬似行
      let inRecord=false, currentRecord=null, curLine=0;
  
      // 1 push = 2行（__markと実コード）＋両方にマッピング
      const push=(s)=>{
        if(s && s.trim()){
          out.push(`__mark(${curLine});`); map.push(curLine);
          out.push(s);                     map.push(curLine);
        }
      };
  
      function parseFieldKind(raw){
        raw = raw.trim();
        // ポインタフィールド: 「T ポインタ x」または「T pointer x」
        let mPtr = raw.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(?:ポインタ|pointer)\s*([A-Za-z_][A-Za-z0-9_]*)$/i);
        if(mPtr){ return {kind:'ptr:'+mPtr[1], name:mPtr[2]}; }
        // 型名とフィールド名
        const parts = raw.split(/\s+/);
        if(parts.length >= 2){
          const tKey = parts[0].toLowerCase();
          const canon = TYPE_SYNONYMS[tKey];
          if(canon){
            const name = parts.slice(1).join(' ').trim();
            let kind;
            if(canon === '整数型') kind = 'int';
            else if(canon === '実数型') kind = 'float';
            else if(canon === '文字列型') kind = 'string';
            else kind = 'bool';
            return {kind: kind, name: name};
          }
        }
        return null;
      }
      function declareBasic(kind,list){
        const names=list.split(',').map(s=>s.trim()).filter(Boolean);
        for(const n of names){
          let jsInit='0',t='int';
          if(kind==='整数型'){jsInit='0';t='int';}
          if(kind==='実数型'){jsInit='0';t='float';}
          if(kind==='文字列型'){jsInit='""';t='string';}
          if(kind==='真偽値'){jsInit='false';t='bool';}
          if(n.endsWith('[]')){ const base=n.slice(0,-2).trim(); push(`let ${base} = [];`); types[base]=t+'_array'; }
          else { push(`let ${n} = ${jsInit};`); types[n]=t; }
        }
      }
      function parseProcParams(paramStr){
        const params = paramStr.trim() ? paramStr.split(',').map(s=>s.trim()) : [];
        const names = [];
        for(const p of params){
          // ポインタパラメータ: 「T ポインタ x」または「T pointer x」
          let mPtr = p.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(?:ポインタ|pointer)\s*([A-Za-z_][A-Za-z0-9_]*)$/i);
          if(mPtr){
            const [,T,name] = mPtr;
            names.push(name);
            // 引数は参照として渡されるため、そのまま取得
            push(`let ${name} = arguments[${names.length-1}];`);
            types[name] = 'ptr:' + T;
            continue;
          }
          // 型付きパラメータ: 「型名 名称」 日本語・英語対応。型名は複数単語かもしれない。
          const parts = p.split(/\s+/).filter(Boolean);
          if(parts.length >= 2){
            // rawType は最後の1語を除いた全てを型名とみなす。例えば "integer array key" -> rawType="integer array" name="key"
            const rawType = parts.slice(0, -1).join(' ').toLowerCase().replace(/\s+/g, ' ');
            const name = parts[parts.length - 1];
            const canon = TYPE_SYNONYMS[rawType];
            if(canon){
              names.push(name);
              let init;
              if(canon === '文字列型') init = '""';
              else if(canon === '真偽値') init = 'false';
              else init = '0';
              push(`let ${name} = (arguments[${names.length-1}]!==undefined)? arguments[${names.length-1}] : ${init};`);
              types[name] = (canon === '整数型') ? 'int' : (canon === '実数型') ? 'float' : (canon === '文字列型') ? 'string' : 'bool';
              continue;
            }
          }
          // 型指定なし: そのまま名前を使用
          const name = p.split(/\s+/).pop();
          names.push(name);
        }
        return names;
      }
      function emitSimpleOrAssign(stmt){
        const s = stmt.trim();
        if(!s) return;
        // 左矢印（←）による代入
        if(s.includes('←')){
          const p = s.split('←');
          const lhs = p[0].trim();
          const rhs = convertExpr(p.slice(1).join('←'));
          const lowerLhs = lhs.toLowerCase();
          if(lhs === '戻り値' || lowerLhs === 'return value' || lowerLhs === 'returnvalue' || lowerLhs === 'return'){
            push(`return ${rhs};`);
          } else {
            push(`${lhs} = ${rhs};`);
          }
          return;
        }
        // 単一 '=' を代入とみなす（比較演算子を除外）
        const eqIndex = s.indexOf('=');
        if(eqIndex > 0){
          const before = s[eqIndex-1];
          const after = s[eqIndex+1];
          const isAssignment = !(before === '=' || before === '!' || before === '<' || before === '>') && (after !== '=');
          if(isAssignment){
            const lhs = s.slice(0, eqIndex).trim();
            const rhs = s.slice(eqIndex+1).trim();
            push(`${lhs} = ${convertExpr(rhs)};`);
            return;
          }
        }
        // それ以外は式または呼び出しとして扱う
        push(convertExpr(s).replace(/;?\s*$/, ';'));
      }
  
      // 行ごとに変換
      let tmpCounter=0;
      for(let i=0;i<lines.length;i++){
        curLine=i+1;
        let raw=lines[i];
        const cpos=raw.indexOf('//'); if(cpos!==-1) raw=raw.slice(0,cpos);
        const line=raw.trim();
  
        // 空行/コメント行：マークだけ（JS 1行、map 1件）
        if(!line){ out.push(`__mark(${curLine});`); map.push(curLine); continue; }
  
        let m;
  
        // レコード定義開始: 「レコード型 T」または「record type T」
        if(!inRecord && (m=line.match(/^(?:レコード型|record\s+type)\s+([A-Za-z_][A-Za-z0-9_]*)$/i))){
          inRecord = true;
          currentRecord = m[1];
          recordDefs[currentRecord] = {fields:{}};
          continue;
        }
        // レコード定義終了: 「レコード型終わり」または「end record type」
        if(inRecord && /^(?:レコード型終わり|end\s+record\s+type)\s*$/i.test(line)){
          inRecord = false;
          currentRecord = null;
          continue;
        }
        if(inRecord){ const f=parseFieldKind(line); if(f){ recordDefs[currentRecord].fields[f.name]=f.kind; } continue; }
  
        // 手続き（プロシージャ）開始: 「手続き NAME(...)」または「procedure NAME(...)」
        if(m = line.match(/^(?:手続き|procedure)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)\s*$/i)){
          const name = m[1];
          const paramStr = m[2];
          push(`function ${name}(){`);
          parseProcParams(paramStr);
          continue;
        }
        // 手続き（プロシージャ）終了: 「手続き終わり」または「end procedure」
        if(/^(?:手続き終わり|end\s*procedure)\s*$/i.test(line)){
          push('}');
          continue;
        }
  
        // 反復(cond)
        if(m=line.match(/^反復\s*\((.*)\)\s*$/)){ push(`while(${convertExpr(m[1])}){`); continue; }
        if(/^反復終わり\s*$/.test(line)){ push('}'); continue; }
  
        // do … until / repeat … until
        if(/^do\s*$/i.test(line)){ push('do{'); continue; }
        if(/^repeat\s*$/i.test(line)){ push('do{'); continue; }
        if(m=line.match(/^until\s*\((.*)\)\s*$/i)){ push(`} while(!(${convertExpr(m[1])}));`); continue; }
  
        // 宣言: 日本語・英語両対応の型宣言 (例: 整数型: x, int: y, integer array: arr[])
        // 型名の部分には空白が含まれる場合があるため、コロンまでをまとめて取得する。
        if(m = line.match(/^([^:]+)\s*:\s*(.+)$/)){
          // 型名をトリムし、小文字化。内部では単語間の複数スペースを1つに揃える。
          const rawType = m[1].trim();
          const tKey = rawType.toLowerCase().replace(/\s+/g, ' ');
          const canon = TYPE_SYNONYMS[tKey];
          if(canon){
            declareBasic(canon, m[2]);
            continue;
          }
        }
        // ポインタ宣言: 「型 ポインタ 変数」または「型 pointer 変数」。型は複数語でもよい。
        if(m = line.match(/^(.*?)\s*(?:ポインタ|pointer)\s*([A-Za-z_][A-Za-z0-9_]*)$/i)){
          const rawType = m[1].trim();
          const T = rawType;
          const v = m[2];
          push(`let ${v} = null;`);
          types[v] = 'ptr:' + T;
          continue;
        }

        // 入力: 日本語「入力(...)」または英語「input(...)」
        if(m = line.match(/^(?:入力|input)\s*\((.*)\)\s*$/i)){
          const vars = m[1].split(',').map(s=>s.trim()).filter(Boolean);
          const sarr = '[' + vars.map(v=>`"${v}"`).join(', ') + ']';
          const tmp = `__tmp_in_${tmpCounter++}`;
          push(`let ${tmp} = __read(${sarr});`);
          for(let k=0; k<vars.length; k++){
            push(`${vars[k]} = ${tmp}[${k}];`);
          }
          continue;
        }

        // 出力・改行: 日本語「出力」「改行」、英語「output」「newline」
        if(m = line.match(/^(?:出力|output)\s*\((.*)\)\s*$/i)){
          push(`__出力(${convertExpr(m[1])});`);
          continue;
        }
        if(/^(?:改行|newline)\s*\(\s*\)\s*$/i.test(line)){
          push(`__改行();`);
          continue;
        }
  
        // 条件/ループ
        if(m=line.match(/^if\s*\((.*)\)\s*$/i)){ push(`if(${convertExpr(m[1])}){`); continue; }
        if(m=line.match(/^elseif\s*\((.*)\)\s*$/i)){ push(`} else if(${convertExpr(m[1])}){`); continue; }
        if(/^else\s*$/i.test(line)){ push('} else {'); continue; }
        if(/^endif\s*$/i.test(line)){ push('}'); continue; }
  
        if(m=line.match(/^for\s*\(([^;]+);([^;]+);\s*([^)]+)\)\s*$/i)){
          const init=convertExpr(m[1]).replace(/←/g,'=');
          const cond=convertExpr(m[2]);
          const step=convertExpr(m[3]).replace(/←/g,'=');
          push(`for(${init}; ${cond}; ${step}){`); continue;
        }
        if(/^endfor\s*$/i.test(line)){ push('}'); continue; }
  
        if(m=line.match(/^while\s*\((.*)\)\s*$/i)){ push(`while(${convertExpr(m[1])}){`); continue; }
        if(/^endwhile\s*$/i.test(line)){ push('}'); continue; }
  
        // 1行に複数文（; 区切り）— forヘッダ以外
        if(line.includes(';') && !/^for\s*\(/i.test(line)){
          const segs = line.split(';');
          for(const seg of segs){ emitSimpleOrAssign(seg); }
          continue;
        }
  
        // 代入（←）
        if(line.includes('←')){ emitSimpleOrAssign(line); continue; }
  
        // その他（式/呼び出し）
        emitSimpleOrAssign(line);
      }
  
      // MAIN 自動実行
      let curBak=curLine; curLine=0; push(`if (typeof MAIN === 'function'){ MAIN(); }`); curLine=curBak;
  
      // マッピング公開
      __LINE_MAP = map;
  
 
// マッピング公開と生成JSの保持（★追加）
__LINE_MAP = map;
const joined = out.join('\n');
__LAST_JS = joined;

// 連結して返す
return joined;
    }
  
    // ========= 実行器（構文/実行時の行番号を逆引き） =========
self.onmessage = function(e){
  const {code, input} = e.data;
  resetInput(input);
  __LINE__ = 0;
  try{
    const compiled = compile(code);
    const prelude = 'function print(){ return __出力.apply(null, arguments); }';
    const fn=new Function('__read','__出力','__改行','types','recordDefs','__new', prelude + '\n' + compiled + '\n//# sourceURL=worker_pseudo.js');
    fn(__read,__出力,__改行,types,recordDefs,__new);
    self.postMessage({type:'done'});
  }catch(err){
    let srcLine = __LINE__ || 0;
    const stack = String(err && err.stack || '');
    let jsLine = null;
    let m = stack.match(/worker_pseudo\.js:(\d+):\d+/) || stack.match(/\(worker_pseudo\.js:(\d+):\d+\)/) || stack.match(/<anonymous>:(\d+):\d+/);
    if (m) jsLine = parseInt(m[1], 10);
    if (!jsLine && (err.lineNumber || err.line)) {
      jsLine = parseInt(err.lineNumber || err.line, 10);
    }
    if (Number.isInteger(jsLine) && jsLine > 0) {
      const mapped = __jsLineToPseudo(jsLine);
      if (mapped) srcLine = mapped;
    }
    const srcText = (__SRC_LINES && __SRC_LINES[srcLine-1]!==undefined) ? __SRC_LINES[srcLine-1] : '';
    self.postMessage({type:'error', line: srcLine, message: err.message, sourceLine: srcText});
  }
};
