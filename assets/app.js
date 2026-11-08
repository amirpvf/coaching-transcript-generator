/* هسته‌ی پردازش: از خروجی ایلون‌لبز تا ردیف‌های جدول و فایل ورد */
(function (root) {
  var ZW = '‌';
  var FA = '؀-ۿ';
  var NB = '(?<![' + FA + '])';   // ابتدای کلمه‌ی فارسی
  var NA = '(?![' + FA + '])';    // انتهای کلمه‌ی فارسی
  var TANVIN = ['فعلا','مثلا','اصلا','قطعا','احتمالا','دقیقا','واقعا','تقریبا','کاملا','حتما','لزوما','معمولا','اتفاقا','اولا','ظاهرا','نسبتا','اساسا','شخصا','بعدا','قبلا'];
  var LOW = -0.6;

  function buildTurns(data) {
    var turns = [];
    (data.words || []).forEach(function (w) {
      if (w.type === 'spacing') { if (turns.length) turns[turns.length - 1].t += ' '; return; }
      if (w.type !== 'word') return;
      var s = w.speaker_id || 'speaker_0';
      var last = turns[turns.length - 1];
      if (!last || last.s !== s) { last = { s: s, st: w.start, t: '', low: [] }; turns.push(last); }
      last.t += w.text;
      if (typeof w.logprob === 'number' && w.logprob < LOW) last.low.push({ st: w.start, w: (w.text || '').trim() });
    });
    return turns;
  }

  /* کوچ: کسی که سؤال بیشتر و حرف کمتری دارد؛ در تساوی، کسی که جلسه را شروع کرده */
  function detectCoach(turns) {
    var st = {};
    turns.forEach(function (t, i) {
      var o = st[t.s] || (st[t.s] = { q: 0, w: 0, first: i });
      o.q += (t.t.match(/[؟?]/g) || []).length;
      o.w += t.t.split(/\s+/).filter(Boolean).length;
    });
    var ids = Object.keys(st);
    if (ids.length < 2) return ids[0];
    ids.sort(function (a, b) {
      var A = st[a], B = st[b];
      var sa = A.q / Math.max(A.w, 1), sb = B.q / Math.max(B.w, 1);
      if (Math.abs(sa - sb) > 0.002) return sb - sa;
      return A.first - B.first;
    });
    return ids[0];
  }

  function clean(t, stats) {
    stats = stats || {};
    var add = function (k, n) { stats[k] = (stats[k] || 0) + n; };
    t = t.replace(/\s+/g, ' ').trim();
    t = t.replace(/\s*--+/g, function () { add('cut', 1); return '...'; });
    TANVIN.forEach(function (a) {
      t = t.replace(new RegExp(NB + a + '(?!ً)' + NA, 'g'), function () { add('tanvin', 1); return a + 'ً'; });
    });
    t = t.replace(new RegExp(NB + '(ن?می)(?![' + ZW + '\\s])([' + FA + ']{2,})', 'g'), function (m, p, rest) {
      if ('اآ'.indexOf(rest[0]) >= 0) return m;
      add('zwnj', 1); return p + ZW + rest;
    });
    t = t.replace(/\s+([،.؟!؛:])/g, function (m, p) { add('space', 1); return p; });
    t = t.replace(new RegExp(ZW + '(?=\\s|$)', 'g'), '');
    return t.replace(/\s+/g, ' ').trim();
  }

  function mmss(s) { s = Math.floor(s); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }

  function process(data, coachId) {
    var turns = buildTurns(data);
    var coach = coachId || detectCoach(turns);
    var stats = {};
    var rows = turns.map(function (t) {
      return { time: mmss(t.st), role: t.s === coach ? 'کوچ' : 'مراجع', text: clean(t.t, stats),
               low: t.low.map(function (l) { return { time: mmss(l.st), w: l.w }; }) };
    });
    var speakers = []; turns.forEach(function (t) { if (speakers.indexOf(t.s) < 0) speakers.push(t.s); });
    var dur = turns.length ? (data.words.filter(function (w) { return w.type === 'word'; }).slice(-1)[0].end) : 0;
    return { rows: rows, coach: coach, speakers: speakers, stats: stats, duration: dur };
  }

  /* ---------- ساخت ورد روی قالب منتور ---------- */
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function cnf(b) {
    return '<w:cnfStyle w:val="000000' + b + '00000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:oddVBand="0" w:evenVBand="0" w:oddHBand="' + b + '" w:evenHBand="0" w:firstRowFirstColumn="0" w:firstRowLastColumn="0" w:lastRowFirstColumn="0" w:lastRowLastColumn="0"/>';
  }
  function cell(w, text, band, align, firstCol) {
    var b = band ? '1' : '0';
    var tc = firstCol ? '<w:cnfStyle w:val="001000000000" w:firstRow="0" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:oddVBand="0" w:evenVBand="0" w:oddHBand="0" w:evenHBand="0" w:firstRowFirstColumn="0" w:firstRowLastColumn="0" w:lastRowFirstColumn="0" w:lastRowLastColumn="0"/>' : '';
    var p = firstCol ? '' : cnf(b);
    var run = text ? '<w:r><w:rPr><w:rFonts w:hint="cs"/><w:color w:val="auto"/><w:rtl/></w:rPr><w:t xml:space="preserve">' + esc(text) + '</w:t></w:r>' : '';
    return '<w:tc><w:tcPr>' + tc + '<w:tcW w:w="' + w + '" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:bidi/><w:jc w:val="' + align + '"/>' + p + '<w:rPr><w:color w:val="auto"/><w:rtl/></w:rPr></w:pPr>' + run + '</w:p></w:tc>';
  }
  function rowsXml(rows) {
    return rows.map(function (r, n) {
      var band = n % 2 === 0, b = band ? '1' : '0';
      var trpr = band ? '<w:trPr>' + cnf(b) + '</w:trPr>' : '<w:trPr/>';
      return '<w:tr>' + trpr + cell(1358, r.time, band, 'center', true) + cell(1648, r.role, band, 'center') +
             cell(8279, r.text, band, 'right') + cell(2018, '', band, 'center') + '</w:tr>';
    }).join('');
  }
  function fillTemplateXml(xml, rows) {
    var re = /<w:tr\b[\s\S]*?<\/w:tr>/g, m, list = [];
    while ((m = re.exec(xml))) list.push({ i: m.index, e: m.index + m[0].length });
    if (list.length < 2) throw new Error('قالب جدول پیدا نشد');
    return xml.slice(0, list[1].i) + rowsXml(rows) + xml.slice(list[list.length - 1].e);
  }
  function buildDocx(JSZip, templateData, rows) {
    return JSZip.loadAsync(templateData).then(function (zip) {
      return zip.file('word/document.xml').async('string').then(function (xml) {
        zip.file('word/document.xml', fillTemplateXml(xml, rows));
        return zip;
      });
    });
  }

  root.CoachCore = { buildTurns: buildTurns, detectCoach: detectCoach, clean: clean, process: process, buildDocx: buildDocx, fillTemplateXml: fillTemplateXml, mmss: mmss };
})(typeof window !== 'undefined' ? window : globalThis);

/* رابط کاربری — مشترک بین نسخه‌ی فارسی و انگلیسی. متن‌ها از window.T می‌آیند. */
(function () {
  var T = window.T;
  var KEY_NAME = 'el_key_v1', key = '', file = null, raw = null, result = null, coachId = null, timer = null;
  var $ = function (id) { return document.getElementById(id); };
  var DIG = '۰۱۲۳۴۵۶۷۸۹';
  function num(s) { return T.faDigits ? String(s).replace(/\d/g, function (d) { return DIG[d]; }) : String(s); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function store(op, k, v) { try { if (op === 'get') return localStorage.getItem(k); if (op === 'set') localStorage.setItem(k, v); if (op === 'del') localStorage.removeItem(k); } catch (e) { return null; } }

  /* theme */
  var th = store('get', 'theme'); if (th) document.documentElement.setAttribute('data-theme', th);
  $('themeBtn').addEventListener('click', function () {
    var cur = document.documentElement.getAttribute('data-theme');
    var dark = cur ? cur === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    var next = dark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next); store('set', 'theme', next);
  });

  /* key */
  function showKey() {
    $('keyForm').classList.toggle('hidden', !!key);
    $('keySaved').classList.toggle('hidden', !key);
    updateGo();
  }
  key = store('get', KEY_NAME) || '';
  $('saveKey').addEventListener('click', function () {
    var v = $('keyIn').value.trim();
    if (!/^sk_[A-Za-z0-9]{20,}$/.test(v)) { alert(T.badKey); return; }
    key = v; store('set', KEY_NAME, v); $('keyIn').value = ''; showKey();
  });
  $('removeKey').addEventListener('click', function () { key = ''; store('del', KEY_NAME); showKey(); });
  showKey();

  /* file */
  $('fileIn').addEventListener('change', function () {
    file = (this.files && this.files[0]) || null;
    $('drop').classList.toggle('has', !!file);
    $('dropTitle').textContent = file ? file.name : T.pickFile;
    $('dropSub').textContent = file ? num((file.size / 1048576).toFixed(1)) + ' ' + T.mb : T.tapToPick;
    updateGo();
  });
  function updateGo() { $('goBtn').disabled = !(key && file); }

  /* status */
  function status(kind, text, pct) {
    $('status').className = 'status show ' + kind;
    $('statusText').textContent = text;
    $('bar').classList.toggle('hidden', kind === 'err');
    $('bar').classList.toggle('indef', pct === null);
    if (pct != null) $('barFill').style.width = pct + '%';
  }
  function errorText(code, body) {
    var msg = ''; try { var j = JSON.parse(body); msg = (j.detail && (j.detail.message || j.detail.status)) || ''; } catch (e) {}
    if (code === 401) return T.err401;
    if (code === 402 || /quota|credit|limit/i.test(msg)) return T.errQuota;
    if (code === 413) return T.errSize;
    if (code === 0) return T.errNet;
    return T.errOther + ' (' + code + ') ' + msg;
  }

  /* run */
  $('goBtn').addEventListener('click', function () {
    var btn = this; btn.disabled = true;
    $('resultCard').classList.add('hidden');
    var fd = new FormData();
    fd.append('model_id', 'scribe_v2');
    fd.append('file', file);
    fd.append('language_code', 'fas');
    fd.append('diarize', 'true');
    fd.append('num_speakers', '2');
    fd.append('timestamps_granularity', 'word');
    fd.append('tag_audio_events', 'false');
    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://api.elevenlabs.io/v1/speech-to-text');
    xhr.setRequestHeader('xi-api-key', key);
    xhr.upload.onprogress = function (e) { if (e.lengthComputable) status('info', T.uploading + ' ' + num(Math.round(e.loaded / e.total * 100)) + '%', e.loaded / e.total * 100); };
    xhr.upload.onload = function () {
      var t0 = Date.now();
      var tick = function () { var s = Math.round((Date.now() - t0) / 1000); status('info', T.working + ' ' + num(Math.floor(s / 60)) + ':' + num(('0' + s % 60).slice(-2)) + ' — ' + T.dontClose, null); };
      tick(); timer = setInterval(tick, 1000);
    };
    xhr.onload = function () {
      clearInterval(timer); btn.disabled = false;
      if (xhr.status !== 200) { status('err', errorText(xhr.status, xhr.responseText)); return; }
      try { raw = JSON.parse(xhr.responseText); } catch (e) { status('err', T.errOther); return; }
      coachId = null; $('status').className = 'status'; render();
    };
    xhr.onerror = function () { clearInterval(timer); btn.disabled = false; status('err', errorText(0)); };
    status('info', T.uploading, 0);
    xhr.send(fd);
  });

  function render() {
    result = CoachCore.process(raw, coachId);
    coachId = result.coach;
    var low = [];
    result.rows.forEach(function (r) { r.low.forEach(function (l) { if (l.w.replace(/[.،؟!?,]/g, '').length > 1) low.push(l); }); });
    $('sDur').textContent = num(CoachCore.mmss(result.duration));
    $('sRows').textContent = num(result.rows.length);
    $('sLow').textContent = num(low.length);
    $('chips').innerHTML = low.map(function (l) { return '<span class="chip"><time>' + num(l.time) + '</time>' + esc(l.w) + '</span>'; }).join('');
    $('reviewBox').classList.toggle('hidden', !low.length);
    $('tbody').innerHTML = result.rows.map(function (r) {
      var txt = esc(r.text);
      r.low.forEach(function (l) {
        var w = esc(l.w.replace(/[.،؟!?,]+$/, ''));
        if (w.length > 1) txt = txt.replace(w, '<mark>' + w + '</mark>');
      });
      var role = r.role === 'کوچ' ? T.coach : T.client;
      return '<tr class="' + (r.role === 'کوچ' ? 'coach' : '') + '"><td class="t">' + num(r.time) + '</td><td class="r">' + role + '</td><td dir="rtl">' + txt + '</td></tr>';
    }).join('');
    $('resultCard').classList.remove('hidden');
    $('resultCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  $('swapBtn').addEventListener('click', function () {
    if (!result) return;
    var other = result.speakers.filter(function (s) { return s !== coachId; })[0];
    if (other) { coachId = other; render(); }
  });

  $('dlBtn').addEventListener('click', function () {
    if (!result) return;
    var bin = atob(window.TEMPLATE_B64), u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    CoachCore.buildDocx(JSZip, u8, result.rows)
      .then(function (z) { return z.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }); })
      .then(function (blob) {
        var name = [T.fileBase, $('coachIn').value.trim()].filter(Boolean).join(' - ').replace(/[\\/:*?"<>|]/g, '');
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = name + '.docx';
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      })
      .catch(function (e) { alert(T.errDocx + ' ' + e.message); });
  });
})();
