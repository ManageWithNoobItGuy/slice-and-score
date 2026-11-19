/* Mini-Python engine for "Slice & Score".
   Supports: ints, floats, strings, f-strings, lists, True/False/None,
   indexing, slicing (with step), + - * / // %, comparisons, in,
   len/int/str/print/sum/max/min/abs/list, a few str/list methods,
   assignment statements and print(). Records index/slice "traces"
   so the UI can animate what Python picked. */
(function (root) {
  'use strict';

  class PyError extends Error {
    constructor(type, msg) { super(type + ': ' + msg); this.pyType = type; this.pyMsg = msg; this.line = null; }
  }
  class PyFloat { constructor(v) { this.v = v; } }

  const UNSUPPORTED = ['for', 'while', 'if', 'elif', 'else', 'def', 'class', 'import', 'from',
    'return', 'lambda', 'try', 'except', 'with', 'and', 'or', 'del', 'global', 'pass', 'break', 'continue'];

  /* ---------------- tokenizer ---------------- */
  function tokenize(src) {
    const toks = [];
    let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
      if (c === '#') { while (i < src.length && src[i] !== '\n') i++; continue; }
      let isF = false;
      if ((c === 'f' || c === 'F') && (src[i + 1] === '"' || src[i + 1] === "'")) { isF = true; i++; }
      const q = src[i];
      if (q === '"' || q === "'") {
        const start = isF ? i - 1 : i;
        let j = i + 1, s = '';
        while (j < src.length && src[j] !== q) {
          if (src[j] === '\\' && j + 1 < src.length) {
            const n = src[j + 1];
            s += n === 'n' ? '\n' : n === 't' ? '\t' : n;
            j += 2; continue;
          }
          if (src[j] === '\n') break;
          s += src[j]; j++;
        }
        if (j >= src.length || src[j] !== q) throw new PyError('SyntaxError', 'unterminated string literal (a quote is missing)');
        toks.push({ t: isF ? 'fstr' : 'str', v: s, pos: start });
        i = j + 1; continue;
      }
      if (/[0-9]/.test(c)) {
        let j = i;
        while (j < src.length && /[0-9_]/.test(src[j])) j++;
        let isFloat = false;
        if (src[j] === '.' && /[0-9]/.test(src[j + 1] || '')) {
          isFloat = true; j++;
          while (j < src.length && /[0-9]/.test(src[j])) j++;
        }
        const text = src.slice(i, j).replace(/_/g, '');
        if (/[A-Za-z_]/.test(src[j] || '')) throw new PyError('SyntaxError', 'invalid decimal literal');
        toks.push({ t: 'num', v: isFloat ? new PyFloat(parseFloat(text)) : parseInt(text, 10), pos: i });
        i = j; continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        let j = i;
        while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
        toks.push({ t: 'name', v: src.slice(i, j), pos: i });
        i = j; continue;
      }
      const two = src.slice(i, i + 2);
      if (['==', '!=', '<=', '>=', '//', '+=', '-=', '**'].includes(two)) { toks.push({ t: 'op', v: two, pos: i }); i += 2; continue; }
      if ('[](),:+-*/%<>=.{}'.includes(c)) { toks.push({ t: 'op', v: c, pos: i }); i++; continue; }
      if ('“”‘’'.includes(c)) throw new PyError('SyntaxError', `invalid character '${c}' — use straight quotes " or '`);
      throw new PyError('SyntaxError', `invalid character '${c}'`);
    }
    toks.push({ t: 'eof', pos: src.length });
    return toks;
  }
  function tokText(k) { return k.t === 'eof' ? 'end of line' : k.t === 'str' ? JSON.stringify(k.v) : String(k.v instanceof PyFloat ? k.v.v : k.v); }

  /* ---------------- parser ---------------- */
  function Parser(toks) { this.t = toks; this.p = 0; }
  Parser.prototype = {
    peek() { return this.t[this.p]; },
    isOp(v) { const k = this.t[this.p]; return k.t === 'op' && k.v === v; },
    eat(v) { if (this.isOp(v)) { this.p++; return true; } return false; },
    expect(v, opener) {
      if (this.isOp(v)) { this.p++; return; }
      const k = this.peek();
      if (k.t === 'eof' && opener) throw new PyError('SyntaxError', `'${opener}' was never closed`);
      if (k.t === 'name' && UNSUPPORTED.includes(k.v)) throw new PyError('SimulatorLimit', `'${k.v}' isn't part of this training ground — try it in real Python!`);
      throw new PyError('SyntaxError', `invalid syntax near ${tokText(k)}`);
    },
    parseExpr() { return this.parseCmp(); },
    parseCmp() {
      const l = this.parseAdd();
      const k = this.peek();
      if (k.t === 'op' && ['==', '!=', '<', '>', '<=', '>='].includes(k.v)) { this.p++; return { type: 'cmp', op: k.v, l, r: this.parseAdd() }; }
      if (k.t === 'name' && k.v === 'in') { this.p++; return { type: 'cmp', op: 'in', l, r: this.parseAdd() }; }
      if (k.t === 'name' && k.v === 'not' && this.t[this.p + 1].t === 'name' && this.t[this.p + 1].v === 'in') {
        this.p += 2; return { type: 'cmp', op: 'not in', l, r: this.parseAdd() };
      }
      return l;
    },
    parseAdd() {
      let l = this.parseMul();
      for (;;) {
        const k = this.peek();
        if (k.t === 'op' && (k.v === '+' || k.v === '-')) { this.p++; l = { type: 'bin', op: k.v, l, r: this.parseMul() }; }
        else return l;
      }
    },
    parseMul() {
      let l = this.parseUnary();
      for (;;) {
        const k = this.peek();
        if (k.t === 'op' && ['*', '/', '//', '%'].includes(k.v)) { this.p++; l = { type: 'bin', op: k.v, l, r: this.parseUnary() }; }
        else return l;
      }
    },
    parseUnary() {
      if (this.isOp('-')) { this.p++; return { type: 'neg', e: this.parseUnary() }; }
      if (this.isOp('+')) { this.p++; return this.parseUnary(); }
      return this.parsePostfix();
    },
    parsePostfix() {
      let e = this.parseAtom();
      for (;;) {
        if (this.isOp('[')) {
          this.p++;
          const idx = this.parseSubscript();
          this.expect(']', '[');
          e = { type: 'sub', obj: e, idx };
        } else if (this.isOp('(')) {
          this.p++;
          const args = [], kw = {};
          while (!this.isOp(')')) {
            const k = this.peek(), k2 = this.t[this.p + 1];
            if (k.t === 'name' && k2.t === 'op' && k2.v === '=') { this.p += 2; kw[k.v] = this.parseExpr(); }
            else args.push(this.parseExpr());
            if (!this.eat(',')) break;
          }
          this.expect(')', '(');
          e = { type: 'call', fn: e, args, kw };
        } else if (this.isOp('.')) {
          this.p++;
          const k = this.peek();
          if (k.t !== 'name') throw new PyError('SyntaxError', 'invalid syntax after .');
          this.p++;
          e = { type: 'attr', obj: e, name: k.v };
        } else return e;
      }
    },
    parseSubscript() {
      let start = null, stop = null, step = null;
      if (this.isOp(']')) throw new PyError('SyntaxError', 'invalid syntax — the [ ] is empty');
      if (!this.isOp(':')) start = this.parseExpr();
      if (!this.isOp(':')) return start;
      this.p++;
      if (!this.isOp(':') && !this.isOp(']')) stop = this.parseExpr();
      if (this.eat(':')) { if (!this.isOp(']')) step = this.parseExpr(); }
      return { type: 'slice', start, stop, step };
    },
    parseAtom() {
      const k = this.peek();
      if (k.t === 'num') { this.p++; return { type: 'const', v: k.v }; }
      if (k.t === 'str') {
        this.p++;
        let v = k.v;
        while (this.peek().t === 'str') { v += this.peek().v; this.p++; }
        return { type: 'const', v };
      }
      if (k.t === 'fstr') { this.p++; return { type: 'fstr', parts: parseFString(k.v) }; }
      if (k.t === 'name') {
        if (UNSUPPORTED.includes(k.v)) throw new PyError('SimulatorLimit', `'${k.v}' isn't part of this training ground — try it in real Python!`);
        this.p++;
        if (k.v === 'True') return { type: 'const', v: true };
        if (k.v === 'False') return { type: 'const', v: false };
        if (k.v === 'None') return { type: 'const', v: null };
        return { type: 'name', id: k.v };
      }
      if (this.isOp('(')) { this.p++; const e = this.parseExpr(); this.expect(')', '('); return e; }
      if (this.isOp('[')) {
        this.p++;
        const items = [];
        while (!this.isOp(']')) {
          items.push(this.parseExpr());
          if (!this.eat(',')) break;
        }
        this.expect(']', '[');
        return { type: 'list', items };
      }
      if (k.t === 'eof') throw new PyError('SyntaxError', 'incomplete — something is missing at the end');
      throw new PyError('SyntaxError', `invalid syntax near ${tokText(k)}`);
    }
  };

  function parseFString(s) {
    const parts = [];
    let buf = '', i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === '{' && s[i + 1] === '{') { buf += '{'; i += 2; continue; }
      if (c === '}' && s[i + 1] === '}') { buf += '}'; i += 2; continue; }
      if (c === '{') {
        let depth = 0, j = i + 1, expr = '';
        for (; j < s.length; j++) {
          const d = s[j];
          if ('[('.includes(d)) depth++;
          if ('])'.includes(d)) depth--;
          if (d === '}' && depth <= 0) break;
          if (d === ':' && depth <= 0) { while (j < s.length && s[j] !== '}') j++; break; }
          expr += d;
        }
        if (j >= s.length) throw new PyError('SyntaxError', "f-string: expecting '}'");
        if (buf) { parts.push(buf); buf = ''; }
        const p = new Parser(tokenize(expr));
        const node = p.parseExpr();
        if (p.peek().t !== 'eof') throw new PyError('SyntaxError', 'f-string: invalid syntax');
        parts.push(node);
        i = j + 1; continue;
      }
      buf += c; i++;
    }
    if (buf) parts.push(buf);
    return parts;
  }

  /* ---------------- values ---------------- */
  function typeName(v) {
    if (v === null) return 'NoneType';
    if (typeof v === 'boolean') return 'bool';
    if (typeof v === 'number') return 'int';
    if (v instanceof PyFloat) return 'float';
    if (typeof v === 'string') return 'str';
    if (Array.isArray(v)) return 'list';
    if (v && v.__fn) return 'builtin_function_or_method';
    return 'object';
  }
  const isIntV = v => typeof v === 'number' || typeof v === 'boolean';
  const toInt = v => typeof v === 'boolean' ? (v ? 1 : 0) : v;
  const isNum = v => isIntV(v) || v instanceof PyFloat;
  const numOf = v => v instanceof PyFloat ? v.v : toInt(v);

  function pyRepr(v) {
    if (v === null) return 'None';
    if (v === true) return 'True';
    if (v === false) return 'False';
    if (typeof v === 'number') return String(v);
    if (v instanceof PyFloat) return Number.isInteger(v.v) ? v.v.toFixed(1) : String(v.v);
    if (typeof v === 'string') {
      const q = (v.includes("'") && !v.includes('"')) ? '"' : "'";
      let s = v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
      if (q === "'") s = s.replace(/'/g, "\\'");
      return q + s + q;
    }
    if (Array.isArray(v)) return '[' + v.map(pyRepr).join(', ') + ']';
    if (v && v.__fn) return `<built-in function ${v.name}>`;
    return String(v);
  }
  const pyStr = v => typeof v === 'string' ? v : pyRepr(v);

  function pyEq(a, b) {
    if (isNum(a) && isNum(b)) return numOf(a) === numOf(b);
    if (typeof a === 'string' && typeof b === 'string') return a === b;
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => pyEq(x, b[i]));
    return a === b;
  }
  // strict: same Python type all the way down (so '4' != 4 and True != 1)
  function strictEq(a, b) {
    if (typeName(a) !== typeName(b)) return false;
    if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => strictEq(x, b[i]));
    return pyEq(a, b);
  }
  function pyLt(a, b, op) {
    if (isNum(a) && isNum(b)) return numOf(a) < numOf(b);
    if (typeof a === 'string' && typeof b === 'string') return a < b;
    if (Array.isArray(a) && Array.isArray(b)) {
      for (let i = 0; i < Math.min(a.length, b.length); i++) {
        if (!pyEq(a[i], b[i])) return pyLt(a[i], b[i], op);
      }
      return a.length < b.length;
    }
    throw new PyError('TypeError', `'${op}' not supported between instances of '${typeName(a)}' and '${typeName(b)}'`);
  }

  /* ---------------- indexing & slicing ---------------- */
  function seqWord(v) { return typeof v === 'string' ? 'string' : 'list'; }
  function checkSeq(obj) {
    const tn = typeName(obj);
    if (tn !== 'str' && tn !== 'list') throw new PyError('TypeError', `'${tn}' object is not subscriptable`);
  }
  function doIndex(obj, i) {
    checkSeq(obj);
    if (!isIntV(i)) {
      if (typeof obj === 'string') throw new PyError('TypeError', `string indices must be integers, not '${typeName(i)}'`);
      throw new PyError('TypeError', `list indices must be integers or slices, not ${typeName(i)}`);
    }
    const n = obj.length;
    let j = toInt(i);
    if (j < 0) j += n;
    if (j < 0 || j >= n) throw new PyError('IndexError', `${seqWord(obj)} index out of range`);
    return { value: obj[j], indices: [j] };
  }
  function sliceIndices(n, start, stop, step) {
    if (step === 0) throw new PyError('ValueError', 'slice step cannot be zero');
    const lower = step > 0 ? 0 : -1, upper = step > 0 ? n : n - 1;
    const adj = (v, dflt) => {
      if (v === null) return dflt;
      if (v < 0) { v += n; if (v < lower) v = lower; }
      else if (v > upper) v = upper;
      return v;
    };
    const s = adj(start, step < 0 ? upper : lower);
    const e = adj(stop, step < 0 ? lower : upper);
    const out = [];
    if (step > 0) for (let i = s; i < e; i += step) out.push(i);
    else for (let i = s; i > e; i += step) out.push(i);
    return { indices: out, start: s, stop: e, step };
  }
  function doSlice(obj, start, stop, step) {
    checkSeq(obj);
    for (const v of [start, stop, step]) {
      if (v !== null && !isIntV(v)) throw new PyError('TypeError', 'slice indices must be integers or None or have an __index__ method');
    }
    const r = sliceIndices(obj.length, start === null ? null : toInt(start), stop === null ? null : toInt(stop), step === null ? 1 : toInt(step));
    const picked = r.indices.map(i => obj[i]);
    return Object.assign(r, { value: typeof obj === 'string' ? picked.join('') : picked });
  }

  /* ---------------- operators ---------------- */
  function binop(op, a, b) {
    if (isNum(a) && isNum(b)) {
      const fl = a instanceof PyFloat || b instanceof PyFloat;
      const x = numOf(a), y = numOf(b);
      const wrap = v => fl ? new PyFloat(v) : v;
      switch (op) {
        case '+': return wrap(x + y);
        case '-': return wrap(x - y);
        case '*': return wrap(x * y);
        case '/': if (y === 0) throw new PyError('ZeroDivisionError', 'division by zero'); return new PyFloat(x / y);
        case '//': if (y === 0) throw new PyError('ZeroDivisionError', 'integer division or modulo by zero'); return wrap(Math.floor(x / y));
        case '%': if (y === 0) throw new PyError('ZeroDivisionError', 'integer modulo by zero'); return wrap(((x % y) + y) % y);
      }
    }
    if (op === '+') {
      if (typeof a === 'string' && typeof b === 'string') return a + b;
      if (Array.isArray(a) && Array.isArray(b)) return a.concat(b);
      if (typeof a === 'string') throw new PyError('TypeError', `can only concatenate str (not "${typeName(b)}") to str`);
      if (Array.isArray(a)) throw new PyError('TypeError', `can only concatenate list (not "${typeName(b)}") to list`);
    }
    if (op === '*') {
      if ((typeof a === 'string' || Array.isArray(a)) && isIntV(b)) return repeat(a, toInt(b));
      if ((typeof b === 'string' || Array.isArray(b)) && isIntV(a)) return repeat(b, toInt(a));
    }
    throw new PyError('TypeError', `unsupported operand type(s) for ${op}: '${typeName(a)}' and '${typeName(b)}'`);
  }
  function repeat(seq, n) {
    if (typeof seq === 'string') return n > 0 ? seq.repeat(Math.min(n, 10000)) : '';
    let out = [];
    for (let i = 0; i < Math.min(n, 10000); i++) out = out.concat(seq);
    return out;
  }
  function compare(op, a, b) {
    switch (op) {
      case '==': return pyEq(a, b);
      case '!=': return !pyEq(a, b);
      case '<': return pyLt(a, b, op);
      case '>': return pyLt(b, a, op);
      case '<=': return pyLt(a, b, op) || pyEq(a, b);
      case '>=': return pyLt(b, a, op) || pyEq(a, b);
      case 'in': case 'not in': {
        let r;
        if (typeof b === 'string') {
          if (typeof a !== 'string') throw new PyError('TypeError', `'in <string>' requires string as left operand, not ${typeName(a)}`);
          r = b.includes(a);
        } else if (Array.isArray(b)) r = b.some(x => pyEq(x, a));
        else throw new PyError('TypeError', `argument of type '${typeName(b)}' is not iterable`);
        return op === 'in' ? r : !r;
      }
    }
  }

  /* ---------------- builtins & methods ---------------- */
  const BUILTINS = {};
  function def(name, fn) { BUILTINS[name] = { __fn: fn, name }; }
  function argc(a, n, name) {
    if (a.length !== n) throw new PyError('TypeError', `${name}() takes exactly ${n} argument${n > 1 ? 's' : ''} (${a.length} given)`);
  }
  function iterOf(v) {
    if (typeof v === 'string') return v.split('');
    if (Array.isArray(v)) return v;
    throw new PyError('TypeError', `'${typeName(v)}' object is not iterable`);
  }
  def('len', a => {
    argc(a, 1, 'len');
    const v = a[0];
    if (typeof v === 'string' || Array.isArray(v)) return v.length;
    throw new PyError('TypeError', `object of type '${typeName(v)}' has no len()`);
  });
  def('int', a => {
    if (a.length === 0) return 0;
    const v = a[0];
    if (isIntV(v)) return toInt(v);
    if (v instanceof PyFloat) return Math.trunc(v.v);
    if (typeof v === 'string') {
      const s = v.trim();
      if (/^[+-]?\d+$/.test(s)) return parseInt(s, 10);
      throw new PyError('ValueError', `invalid literal for int() with base 10: ${pyRepr(v)}`);
    }
    throw new PyError('TypeError', `int() argument must be a string, a bytes-like object or a real number, not '${typeName(v)}'`);
  });
  def('str', a => a.length ? pyStr(a[0]) : '');
  def('print', (a, ctx, kw) => {
    const sep = kw.sep !== undefined ? pyStr(kw.sep) : ' ';
    const end = kw.end !== undefined ? pyStr(kw.end) : '\n';
    ctx.stdout += a.map(pyStr).join(sep) + end;
    return null;
  });
  def('sum', a => {
    const xs = iterOf(a[0]);
    let t = 0;
    for (const x of xs) t = binop('+', t, x);
    return t;
  });
  function minmax(name, a, wantMax) {
    const xs = a.length === 1 ? iterOf(a[0]) : a;
    if (!xs.length) throw new PyError('ValueError', `${name}() iterable argument is empty`);
    let best = xs[0];
    for (const x of xs.slice(1)) if (wantMax ? pyLt(best, x, '<') : pyLt(x, best, '<')) best = x;
    return best;
  }
  def('max', a => minmax('max', a, true));
  def('min', a => minmax('min', a, false));
  def('abs', a => { const v = a[0]; if (v instanceof PyFloat) return new PyFloat(Math.abs(v.v)); if (isIntV(v)) return Math.abs(toInt(v)); throw new PyError('TypeError', `bad operand type for abs(): '${typeName(v)}'`); });
  def('list', a => a.length ? iterOf(a[0]).slice() : []);

  function needStr(v, m) { if (typeof v !== 'string') throw new PyError('TypeError', `${m}() argument must be str, not ${typeName(v)}`); return v; }
  const METHODS = {
    str: {
      upper: s => s.toUpperCase(),
      lower: s => s.toLowerCase(),
      count: (s, a) => { const sub = needStr(a[0], 'count'); return sub === '' ? s.length + 1 : s.split(sub).length - 1; },
      index: (s, a) => { const i = s.indexOf(needStr(a[0], 'index')); if (i < 0) throw new PyError('ValueError', 'substring not found'); return i; },
      find: (s, a) => s.indexOf(needStr(a[0], 'find')),
      startswith: (s, a) => s.startsWith(needStr(a[0], 'startswith')),
      endswith: (s, a) => s.endsWith(needStr(a[0], 'endswith')),
    },
    list: {
      count: (l, a) => l.filter(x => pyEq(x, a[0])).length,
      index: (l, a) => { const i = l.findIndex(x => pyEq(x, a[0])); if (i < 0) throw new PyError('ValueError', `${pyRepr(a[0])} is not in list`); return i; },
    }
  };
  function getAttr(obj, name) {
    const tn = typeName(obj);
    const m = (METHODS[tn] || {})[name];
    if (!m) {
      if (Array.isArray(obj) && ['append', 'pop', 'insert', 'remove', 'sort', 'reverse'].includes(name))
        throw new PyError('SimulatorLimit', `.${name}() changes the list — this training ground only reads data. Try it in real Python!`);
      throw new PyError('AttributeError', `'${tn}' object has no attribute '${name}'`);
    }
    return { __fn: args => m(obj, args), name };
  }

  /* ---------------- evaluator ---------------- */
  function evaluate(node, env, ctx) {
    if (++ctx.steps > 200000) throw new PyError('SimulatorLimit', 'that took too long');
    switch (node.type) {
      case 'const': return node.v;
      case 'name':
        if (Object.prototype.hasOwnProperty.call(env, node.id)) return env[node.id];
        if (BUILTINS[node.id]) return BUILTINS[node.id];
        throw new PyError('NameError', `name '${node.id}' is not defined`);
      case 'list': return node.items.map(n => evaluate(n, env, ctx));
      case 'fstr': return node.parts.map(p => typeof p === 'string' ? p : pyStr(evaluate(p, env, ctx))).join('');
      case 'neg': {
        const v = evaluate(node.e, env, ctx);
        if (isIntV(v)) return -toInt(v) || 0;
        if (v instanceof PyFloat) return new PyFloat(-v.v);
        throw new PyError('TypeError', `bad operand type for unary -: '${typeName(v)}'`);
      }
      case 'bin': return binop(node.op, evaluate(node.l, env, ctx), evaluate(node.r, env, ctx));
      case 'cmp': return compare(node.op, evaluate(node.l, env, ctx), evaluate(node.r, env, ctx));
      case 'attr': return getAttr(evaluate(node.obj, env, ctx), node.name);
      case 'call': {
        const fn = evaluate(node.fn, env, ctx);
        const args = node.args.map(a => evaluate(a, env, ctx));
        const kw = {};
        for (const k in node.kw) kw[k] = evaluate(node.kw[k], env, ctx);
        if (!fn || !fn.__fn) throw new PyError('TypeError', `'${typeName(fn)}' object is not callable`);
        if (Object.keys(kw).length && fn.name !== 'print') throw new PyError('TypeError', `${fn.name}() takes no keyword arguments`);
        return fn.__fn(args, ctx, kw);
      }
      case 'sub': return evalSub(node, env, ctx);
    }
    throw new PyError('SyntaxError', 'invalid syntax');
  }

  function evalSub(node, env, ctx) {
    const obj = evaluate(node.obj, env, ctx);
    let rec = null;
    if (node.obj.type === 'name') rec = { name: node.obj.id, depth: 0, len: lenOf(obj) };
    else if (node.obj.type === 'sub') {
      const inner = ctx.trace[ctx.trace.length - 1];
      if (inner && inner.depth === 0 && inner.kind === 'index' && !inner.error)
        rec = { name: inner.name, depth: 1, row: inner.indices[0], len: lenOf(obj) };
    }
    const push = r => { if (rec) { Object.assign(rec, r); ctx.trace.push(rec); } };
    if (node.idx && node.idx.type === 'slice') {
      const ev = n => n ? evaluate(n, env, ctx) : null;
      const s = ev(node.idx.start), e = ev(node.idx.stop), st = ev(node.idx.step);
      try {
        const r = doSlice(obj, s, e, st);
        push({ kind: 'slice', indices: r.indices, start: r.start, stop: r.stop, step: r.step });
        return r.value;
      } catch (err) { push({ kind: 'slice', error: err }); throw err; }
    }
    const i = evaluate(node.idx, env, ctx);
    try {
      const r = doIndex(obj, i);
      push({ kind: 'index', indices: r.indices });
      return r.value;
    } catch (err) { push({ kind: 'index', error: err, attempted: isIntV(i) ? toInt(i) : null }); throw err; }
  }
  function lenOf(v) { return (typeof v === 'string' || Array.isArray(v)) ? v.length : null; }

  /* ---------------- program runner ---------------- */
  function splitLogicalLines(src) {
    const lines = src.replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let buf = null, startLine = 0, depth = 0;
    for (let n = 0; n < lines.length; n++) {
      const raw = lines[n];
      // an unclosed bracket followed by what is clearly a new statement: report it on its own line
      if (buf !== null && /^(?:[A-Za-z_]\w*\s*(?:=[^=]|\+=|-=)|print\s*\()/.test(raw)) {
        out.push({ text: buf, line: startLine }); buf = null; depth = 0;
      }
      let code = '', q = null;
      for (let i = 0; i < raw.length; i++) {
        const c = raw[i];
        if (q) {
          code += c;
          if (c === '\\') { code += raw[i + 1] || ''; i++; continue; }
          if (c === q) q = null;
          continue;
        }
        if (c === '"' || c === "'") { q = c; code += c; continue; }
        if (c === '#') break;
        if ('([{'.includes(c)) depth++;
        else if (')]}'.includes(c)) depth = Math.max(0, depth - 1);
        code += c;
      }
      if (buf === null) { buf = code; startLine = n + 1; }
      else buf += ' ' + code.trim();
      if (depth === 0 || q) { out.push({ text: buf, line: startLine }); buf = null; depth = 0; }
    }
    if (buf !== null && buf.trim()) out.push({ text: buf, line: startLine });
    return out;
  }

  function run(src, env, opts) {
    opts = opts || {};
    const ctx = { stdout: '', trace: [], assigns: {}, steps: 0 };
    const res = { ok: true, error: null, value: undefined, out: [], trace: [], assigns: ctx.assigns };
    for (const L of splitLogicalLines(src)) {
      if (!L.text.trim()) continue;
      ctx.trace = [];
      try {
        if (/^\s+\S/.test(L.text)) throw new PyError('IndentationError', 'unexpected indent (remove the spaces at the start)');
        const toks = tokenize(L.text);
        if (toks[0].t === 'name' && UNSUPPORTED.includes(toks[0].v))
          throw new PyError('SimulatorLimit', `'${toks[0].v}' isn't part of this training ground — try it in real Python!`);
        if (toks[0].t === 'name' && toks[0].v === 'print' && toks[1].t !== 'eof' && !(toks[1].t === 'op' && toks[1].v === '('))
          throw new PyError('SyntaxError', "Missing parentheses in call to 'print'. Did you mean print(...)?");
        let target = null, aug = null, start = 0;
        if (toks[0].t === 'name' && toks[1].t === 'op' && ['=', '+=', '-='].includes(toks[1].v)) {
          target = toks[0].v; aug = toks[1].v === '=' ? null : toks[1].v[0]; start = 2;
          if (['True', 'False', 'None'].includes(target)) throw new PyError('SyntaxError', `cannot assign to ${target}`);
        }
        const p = new Parser(toks);
        p.p = start;
        if (target && p.peek().t === 'eof') throw new PyError('SyntaxError', 'invalid syntax — nothing after =');
        const node = p.parseExpr();
        if (p.peek().t !== 'eof') {
          if (p.isOp('=')) throw new PyError('SimulatorLimit', 'changing items (like squad[0] = ...) isn\'t part of this training ground — here we only read data');
          throw new PyError('SyntaxError', `invalid syntax near ${tokText(p.peek())}`);
        }
        let v = evaluate(node, env, ctx);
        if (target) {
          if (aug) {
            if (!Object.prototype.hasOwnProperty.call(env, target)) throw new PyError('NameError', `name '${target}' is not defined`);
            v = binop(aug, env[target], v);
          }
          env[target] = v;
          ctx.assigns[target] = { rhs: L.text.slice(toks[start].pos).trim(), line: L.line, value: v };
        } else {
          res.value = v;
          if (opts.repl && v !== null) ctx.stdout += pyRepr(v) + '\n';
        }
      } catch (e) {
        let err = e;
        if (!(e instanceof PyError)) err = new PyError(e instanceof RangeError ? 'RecursionError' : 'InternalError', String(e && e.message || e));
        err.line = L.line;
        res.ok = false; res.error = err;
        break;
      }
    }
    res.trace = ctx.trace;
    res.out = ctx.stdout === '' ? [] : ctx.stdout.replace(/\n$/, '').split('\n');
    return res;
  }

  root.Py = { run, repr: pyRepr, str: pyStr, eq: pyEq, strictEq, typeName, PyError, PyFloat, sliceIndices };
})(typeof window !== 'undefined' ? window : globalThis);
