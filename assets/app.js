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
  var KEY_NAME = 'el_key_v1', key = '', file = null, raw = null, result = null, coachId = null, timer = null, uploaded = false, busy = false, wl = null, leftPage = false;
  function lockOn() { try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { wl = l; }).catch(function () {}); } catch (e) {} }
  function lockOff() { try { if (wl) wl.release(); } catch (e) {} wl = null; }
  document.addEventListener('visibilitychange', function () { if (busy && document.hidden) leftPage = true; if (busy && !document.hidden) lockOn(); });
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
    var msg = '', st = ''; try { var j = JSON.parse(body); st = (j.detail && j.detail.status) || ''; msg = (j.detail && (j.detail.message || j.detail.status)) || ''; } catch (e) {}
    if (st === 'detected_unusual_activity' || /unusual activity|proxy|vpn/i.test(msg)) return T.errFlag;
    if (code === 401) return T.err401 + (msg ? ' [' + msg + ']' : '');
    if (code === 402 || /quota|credit|limit/i.test(msg)) return T.errQuota;
    if (code === 413) return T.errSize;
    if (code === 0) return uploaded ? T.errLost : T.errNet;
    return T.errOther + ' (' + code + ') ' + msg;
  }

  /* run */
  var CHUNK_MB = 12, CHUNK_SEC = 480, TRIES = 3;

  /* یک فایل یا تکه را به ایلون‌لبز می‌فرستد؛ در صورت قطع شدن تا ۳ بار دوباره تلاش می‌کند */
  function send(blob, name, label) {
    return new Promise(function (resolve, reject) {
      var attempt = 0;
      (function go() {
        attempt++; uploaded = false;
        var fd = new FormData();
        fd.append('model_id', 'scribe_v2');
        fd.append('file', blob, name);
        fd.append('language_code', 'fas');
        fd.append('diarize', 'true');
        fd.append('num_speakers', '2');
        fd.append('timestamps_granularity', 'word');
        fd.append('tag_audio_events', 'false');
        var xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://api.elevenlabs.io/v1/speech-to-text');
        xhr.setRequestHeader('xi-api-key', key);
        var pre = label ? label + ' — ' : '';
        var retry = attempt > 1 ? ' (' + T.retry + ' ' + num(attempt) + ')' : '';
        xhr.upload.onprogress = function (e) { if (e.lengthComputable) status('info', pre + T.uploading + ' ' + num(Math.round(e.loaded / e.total * 100)) + '%' + retry, e.loaded / e.total * 100); };
        xhr.upload.onload = function () {
          uploaded = true; clearInterval(timer);
          var t0 = Date.now();
          var tick = function () { var s = Math.round((Date.now() - t0) / 1000); status('info', pre + T.working + ' ' + num(Math.floor(s / 60)) + ':' + num(('0' + s % 60).slice(-2)) + ' — ' + T.dontClose, null); };
          tick(); timer = setInterval(tick, 1000);
        };
        xhr.onload = function () {
          clearInterval(timer);
          if (xhr.status === 200) { try { resolve(JSON.parse(xhr.responseText)); } catch (e) { reject(T.errOther); } return; }
          if (xhr.status >= 500 && attempt < TRIES) { setTimeout(go, 3000); return; }
          reject(errorText(xhr.status, xhr.responseText));
        };
        xhr.onerror = function () {
          clearInterval(timer);
          if (attempt < TRIES) { status('info', pre + T.reconnect, null); setTimeout(go, 4000); return; }
          reject(errorText(0) + (leftPage ? ' ' + T.errLeft : ''));
        };
        status('info', pre + T.uploading + retry, 0);
        xhr.send(fd);
      })();
    });
  }

  /* ---------- حالت تکه‌تکه برای فایل‌های بلند ---------- */
  function wav(samples, rate) {
    var n = samples.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    function str(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, n * 2, true);
    for (var i = 0, o = 44; i < n; i++, o += 2) { var x = Math.max(-1, Math.min(1, samples[i])); v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
    return new Blob([buf], { type: 'audio/wav' });
  }
  /* نقطه‌ی برش را در کم‌صداترین لحظه‌ی نزدیک به مرز انتخاب می‌کند تا کلمه‌ای نصف نشود */
  function quietCut(d, rate, target) {
    var win = Math.round(rate * 0.25), span = rate * 20, best = target, bestE = Infinity;
    for (var c = Math.max(win, target - span); c < Math.min(d.length - win, target + span); c += win) {
      var e = 0; for (var i = c - win; i < c; i += 4) e += d[i] * d[i];
      if (e < bestE) { bestE = e; best = c; }
    }
    return best;
  }
  function decode(f) {
    var RATE = 16000;
    return f.arrayBuffer().then(function (ab) {
      var Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      var ctx = new Ctx(1, RATE, RATE);
      return new Promise(function (res, rej) { var p = ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); });
    }).then(function (ab) {
      var d = ab.getChannelData(0);
      if (ab.numberOfChannels > 1) { var d2 = ab.getChannelData(1), m = new Float32Array(d.length); for (var i = 0; i < d.length; i++) m[i] = (d[i] + d2[i]) / 2; d = m; }
      return { d: d, rate: ab.sampleRate };
    });
  }
  /* گوینده‌های هر تکه را جداگانه به کوچ (C) و مراجع (K) نگاشت می‌کند، سپس همه را با زمان درست کنار هم می‌گذارد */
  function merge(parts) {
    var words = [];
    parts.forEach(function (p) {
      var turns = CoachCore.buildTurns(p.data), ids = {};
      turns.forEach(function (t) { ids[t.s] = 1; });
      var coach = CoachCore.detectCoach(turns);
      if (Object.keys(ids).length === 1) {
        var q = 0, w = 0; turns.forEach(function (t) { q += (t.t.match(/[؟?]/g) || []).length; w += t.t.split(/\s+/).length; });
        coach = q / Math.max(w, 1) > 0.02 ? coach : null;
      }
      (p.data.words || []).forEach(function (x) {
        var y = {}; for (var k in x) y[k] = x[k];
        y.start = (x.start || 0) + p.offset; y.end = (x.end || 0) + p.offset;
        if (x.type === 'word') y.speaker_id = x.speaker_id === coach ? 'C' : 'K';
        words.push(y);
      });
      words.push({ type: 'spacing', text: ' ' });
    });
    return { words: words };
  }
  function runChunked() {
    status('info', T.preparing, null);
    return decode(file).then(function (a) {
      var d = a.d, rate = a.rate, step = CHUNK_SEC * rate, cuts = [0];
      while (d.length - cuts[cuts.length - 1] > step * 1.25) cuts.push(quietCut(d, rate, cuts[cuts.length - 1] + step));
      cuts.push(d.length);
      var total = cuts.length - 1, parts = [], i = 0;
      function next() {
        if (i >= total) return Promise.resolve(parts);
        var a0 = cuts[i], a1 = cuts[i + 1], idx = i;
        var blob = wav(d.subarray(a0, a1), rate);
        var label = T.part + ' ' + num(idx + 1) + ' ' + T.of + ' ' + num(total);
        return send(blob, 'part' + (idx + 1) + '.wav', label).then(function (data) {
          parts.push({ data: data, offset: a0 / rate }); i++; return next();
        });
      }
      return next();
    }).then(merge);
  }

  $('goBtn').addEventListener('click', function () {
    var btn = this; btn.disabled = true; busy = true; leftPage = false; lockOn();
    $('resultCard').classList.add('hidden');
    var job = file.size > CHUNK_MB * 1048576
      ? runChunked().catch(function (e) { if (typeof e === 'string') throw e; throw T.errDecode; })
      : send(file, file.name, '');
    job.then(function (data) {
      raw = data; coachId = null; $('status').className = 'status'; render();
    }).catch(function (msg) {
      status('err', typeof msg === 'string' ? msg : T.errOther);
    }).then(function () { clearInterval(timer); btn.disabled = false; busy = false; lockOff(); });
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
