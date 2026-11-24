/* 西语树洞留言展示 */
(function () {
  'use strict';

  /* 把问卷星链接填在这里，例如 https://www.wjx.cn/vm/xxxx.aspx
     填了之后，弹窗里会出现「打开问卷」按钮；不填就只显示二维码。 */
  var QUESTIONNAIRE_URL = 'https://www.wjx.cn/vm/tHQC0yr.aspx#';

  var DATA = window.TREEHOLE_DATA || { meta: {}, posts: [] };
  var META = DATA.meta || {};
  var POSTS = (DATA.posts || []).slice().sort(function (a, b) { return b.no - a.no; });
  var byId = {};
  POSTS.forEach(function (p) { byId[p.id] = p; });

  var LATEST = (META.latest || []).map(function (id) { return byId[id]; }).filter(Boolean);
  if (!LATEST.length) {
    LATEST = POSTS.filter(function (p) { return p.source !== 'wechat'; }).slice(0, 4);
  }
  var LATEST_SET = {};
  LATEST.forEach(function (p) { LATEST_SET[p.id] = true; });

  function shuffled(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  // 每次打开随机挑 24 条做首页；最新投稿固定在上方，不参与随机；其余仍按编号倒序
  var FEATURED = shuffled(POSTS.filter(function (p) { return !LATEST_SET[p.id]; }))
    .slice(0, 24).map(function (p) { return p.id; });

  var TOPICS = ['全部'].concat(META.topics || []);
  if (TOPICS.indexOf('避雷') === -1) TOPICS.push('避雷');
  var TYPE_CLASS = { '提问': 'question', '倾诉': 'vent', '经验': 'exp', '避雷': 'warn' };
  var TOPIC_CLASS = {
    '学习考证': 'study', '考研升学': 'kaoyan', '留学交换': 'abroad', '外派海外': 'overseas',
    '求职就业': 'job', 'Offer 选择': 'offer', '考公体制': 'gov', '校园生活': 'campus'
  };

  var state = { view: 'posts', topic: '全部', q: '', limit: 24 };
  var PARAMS = new URLSearchParams(location.search);
  var IS_WECHAT = /MicroMessenger/i.test(navigator.userAgent);
  if (IS_WECHAT) document.body.classList.add('is-wechat');
  if (PARAMS.get('limit')) state.limit = Math.max(1, parseInt(PARAMS.get('limit'), 10) || 24);
  if (PARAMS.get('view')) state.view = PARAMS.get('view');
  if (PARAMS.get('cols') === '2') document.body.classList.add('force-2col');
  var speakId = null;
  var searchTimer = null;

  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function pad(id) { return String(id).padStart(3, '0'); }

  function cardUrl(id) {
    var u = new URL(location.href);
    u.hash = '';
    u.search = '';
    u.searchParams.set('id', id);
    return u.toString();
  }

  /* 打开卡片时把 id 写进地址栏，微信右上角「···」分享出去的就是这张卡 */
  function setUrlId(id) {
    try {
      var u = new URL(location.href);
      if (id) u.searchParams.set('id', id);
      else u.searchParams.delete('id');
      history.replaceState(null, '', u);
    } catch (e) {}
  }

  function excerpt(s, n) {
    var t = cleanText(s).replace(/\n+/g, ' ');
    return t.length > n ? t.slice(0, n) + '…' : t;
  }

  function cleanText(s) {
    return String(s == null ? '' : s)
      .replace(/\r/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]*\n+/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  function paragraphText(s) {
    return cleanText(s).replace(/\n/g, '\n\n');
  }

  var ICON_ANSWER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z"/></svg>';
  var ICON_WARN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v5"/><circle cx="12" cy="17.2" r=".8" fill="currentColor" stroke="none"/></svg>';

  function syncView() {
    $$('[data-view]').forEach(function (b) {
      if (b.id === 'qaLink') return;
      var on = b.getAttribute('data-view') === state.view;
      b.classList.toggle('is-active', on);
      if (b.classList.contains('tab')) b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    var qa = $('#qaLink');
    if (qa) {
      var qaEmoji = qa.querySelector('.qa-emoji');
      var qaArrow = qa.querySelector('.qa-arrow');
      var qaLines = qa.querySelectorAll('.qa-line');
      if (state.view === 'qa') {
        if (qaEmoji) qaEmoji.textContent = '←';
        if (qaLines[0]) qaLines[0].textContent = '回到全部留言';
        if (qaLines[1]) { qaLines[1].textContent = ''; qaLines[1].hidden = true; }
        if (qaArrow) qaArrow.textContent = '';
        qa.setAttribute('data-view', 'posts');
      } else {
        if (qaEmoji) qaEmoji.textContent = '💬';
        if (qaLines[0]) qaLines[0].textContent = '去【西语人的提问】专区看看，';
        if (qaLines[1]) { qaLines[1].textContent = '期待你的解答和建议~'; qaLines[1].hidden = false; }
        if (qaArrow) qaArrow.textContent = '→';
        qa.setAttribute('data-view', 'qa');
      }
    }
    var isLatest = state.view === 'latest';
    var latestSection = $('#latest');
    if (latestSection) latestSection.hidden = isLatest;
    var fab = $('#backHomeFab');
    if (fab) fab.hidden = !isLatest;
    document.body.classList.toggle('is-latest', isLatest);
    var title = $('#browseTitle');
    if (title) title.textContent = isLatest ? '最新投稿' : (state.view === 'qa' ? '西语人的提问' : '翻一翻留言');
    var bail = document.querySelector('[data-topic="避雷"]');
    if (bail) bail.hidden = state.view === 'qa';
  }

  function buildControls() {
    $('#topicChips').innerHTML = TOPICS.map(function (t) {
      return '<button class="chip' + (t === state.topic ? ' is-active' : '') + '" data-topic="' + esc(t) + '">' + esc(t) + '</button>';
    }).join('');
  }

  function byDate(a, b) {
    var da = a.date || '', db = b.date || '';
    if (da !== db) return db.localeCompare(da);
    return b.no - a.no;
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var list = POSTS.filter(function (p) {
      if (state.view === 'qa' && p.type !== '提问') return false;
      if (state.topic === '避雷') {
        if (p.type !== '避雷') return false;
      } else if (state.topic !== '全部' && p.topic !== state.topic) {
        return false;
      }
      if (q) {
        var hay = (p.text + ' #' + p.id + ' ' + p.topic + ' ' + p.type).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    var isHome = state.view === 'posts' && state.topic === '全部' && !q;
    if (isHome) {
      var head = FEATURED.map(function (id) { return byId[id]; }).filter(Boolean);
      var seen = {};
      head.forEach(function (p) { seen[p.id] = true; });
      var tail = list.filter(function (p) { return !seen[p.id]; })
        .sort(function (a, b) { return b.no - a.no; });
      return head.concat(tail);
    }

    if (state.view === 'latest') {
      var latestSet = {};
      var head = [];
      LATEST.forEach(function (p) {
        latestSet[p.id] = true;
        if (list.indexOf(p) !== -1) head.push(p);
      });
      var rest = list.filter(function (p) {
        return p.source !== 'wechat' && !latestSet[p.id];
      });
      rest.sort(byDate);
      return head.concat(rest);
    }

    if (state.view === 'qa') {
      list.sort(function (a, b) {
        var an = (a.answers && a.answers.length) || 0;
        var bn = (b.answers && b.answers.length) || 0;
        if (bn !== an) return bn - an;
        return b.no - a.no;
      });
    } else {
      list.sort(function (a, b) { return b.no - a.no; });
    }
    return list;
  }

  function cardHTML(p) {
    var cls = TYPE_CLASS[p.type] || 'vent';
    var answers = p.answers || [];
    var first = answers[0];
    var isWarn = p.type === '避雷';
    var isWechat = p.source === 'wechat';

    var html = '<article class="card' + (isWarn ? ' card-warn' : '') + '" data-id="' + p.id + '" tabindex="0" aria-label="' +
      esc('#' + pad(p.id) + ' ' + p.type + ' ' + p.topic) + '">';

    html += '<div class="card-head">';
    html += '<span class="badge badge-' + cls + '">' + esc(p.type) + '</span>';
    html += '<span class="topic-pill topic-' + (TOPIC_CLASS[p.topic] || 'campus') + '">' + esc(p.topic) + '</span>';
    html += '<span class="card-no">#' + pad(p.id) + '</span>';
    html += '</div>';

    html += '<p class="card-text">' + esc(paragraphText(p.text)) + '</p>';
    html += '<button class="card-more" data-more>展开全文 ↓</button>';

    if (answers.length) {
      html += '<div class="card-answers">';
      html += '<div class="answers-label">西语人留言</div>';
      html += '<p class="answer-preview">' + esc(cleanText(first.text)) + '</p>';
      if (answers.length > 1) {
        html += '<button class="more-answers" data-open="' + p.id + '">查看全部留言 →</button>';
      }
      html += '</div>';
    }

    if (isWarn) {
      html += '<div class="warn-note">' + ICON_WARN + '<span>化名处理 · 仅为' + (isWechat ? '网友' : '投稿人') + '个人经历</span></div>';
    }

    html += '<div class="card-foot">';
    html += '<span class="answer-count' + (answers.length ? ' is-zero' : '') + '">' +
      (answers.length ? '' : '还没有留言') + '</span>';
    html += '<span class="card-btns">';
    html += '<button class="share-btn" data-share="' + p.id + '" aria-label="分享这条留言">📤 分享</button>';
    html += '<button class="respond-btn" data-respond="' + p.id + '">回应这条</button>';
    html += '</span>';
    html += '</div>';
    html += '</article>';
    return html;
  }

  function markLong(root) {
    $$('.card', root).forEach(function (card) {
      var text = $('.card-text', card);
      if (!text) return;
      var long = text.scrollHeight > text.clientHeight + 4 || text.textContent.length > 230;
      if (long) card.classList.add('is-long');
    });
  }

  function renderLatest() {
    var grid = $('#latestGrid');
    if (!grid) return;
    grid.innerHTML = LATEST.map(cardHTML).join('');
    markLong(grid);
    var note = $('#latestNote');
    if (note) note.textContent = '最近更新的 ' + LATEST.length + ' 条';
  }

  function render() {
    var list = filtered();
    var shown = list.slice(0, state.limit);
    var grid = $('#grid');

    grid.innerHTML = shown.map(cardHTML).join('');
    markLong(grid);

    $('#empty').hidden = list.length !== 0;

    var moreBtn = $('#loadMore');
    var note = $('#loadNote');
    if (list.length > state.limit) {
      moreBtn.hidden = false;
      note.textContent = '下面还有';
    } else {
      moreBtn.hidden = true;
      note.textContent = list.length ? '到底了' : '';
    }
  }

  /* ---------- 弹窗 ---------- */
  function openModal(m) {
    $$('.modal.is-open').forEach(function (x) { if (x !== m) closeModal(x); });
    m.classList.add('is-open');
    m.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  }
  function closeModal(m) {
    m.classList.remove('is-open');
    m.setAttribute('aria-hidden', 'true');
    if (!$('.modal.is-open')) document.body.classList.remove('modal-open');
  }
  function closeAll() { $$('.modal.is-open').forEach(closeModal); }

  function openDetail(id) {
    var p = byId[id];
    if (!p) return;
    var answers = p.answers || [];
    var cls = TYPE_CLASS[p.type] || 'vent';
    var html = '';

    html += '<div class="detail-meta">';
    html += '<span class="badge badge-' + cls + '">' + esc(p.type) + '</span>';
    html += '<span class="topic-pill topic-' + (TOPIC_CLASS[p.topic] || 'campus') + '">' + esc(p.topic) + '</span>';
    html += '<span class="card-no">#' + pad(p.id) + '</span>';
    html += '</div>';

    html += '<div class="detail-actions detail-actions-top">';
    html += '<button class="btn btn-primary btn-small" data-respond="' + p.id + '">回应这条</button>';
    html += '<button class="btn btn-ghost btn-small" data-share="' + p.id + '">📤 分享这条</button>';
    html += '<button class="btn btn-ghost btn-small" data-copy="' + p.id + '">复制编号</button>';
    if (p.articleUrl) {
      html += '<a class="btn btn-ghost btn-small" href="' + esc(p.articleUrl) + '" target="_blank" rel="noopener">公众号原文 ↗</a>';
    }
    html += '</div>';

    html += '<p class="detail-text">' + esc(paragraphText(p.text)) + '</p>';
    if (p.note) html += '<p class="detail-note' + (p.type === '避雷' ? ' warn' : '') + '">' + esc(p.note) + '</p>';
    html += '<p class="detail-disclaimer">来自公众号「西语SuperO」的网友留言，仅代表留言者个人观点，不代表平台意见。</p>';

    if (answers.length) {
      html += '<div class="detail-answers"><h3>西语人留言</h3>';
      answers.forEach(function (a) {
        html += '<div class="answer"><div class="answer-no comment">西语人留言</div><p>' + esc(paragraphText(a.text)) + '</p></div>';
      });
      html += '</div>';
    }

    html += '<div class="detail-actions">';
    html += '<button class="btn btn-primary" data-respond="' + p.id + '">回应这条</button>';
    html += '<button class="btn btn-ghost" data-share="' + p.id + '">📤 分享这条</button>';
    html += '<button class="btn btn-ghost" data-copy="' + p.id + '">复制编号</button>';
    html += '</div>';

    $('#detailContent').innerHTML = html;
    openModal($('#detailModal'));
    setUrlId(id);
  }

  function setQuestionnaireLink() {
    var link = $('#questionnaireLink');
    var note = $('#linkNote');
    if (QUESTIONNAIRE_URL) {
      link.href = QUESTIONNAIRE_URL;
      link.hidden = false;
      note.hidden = true;
    } else {
      link.hidden = true;
      note.hidden = false;
      note.textContent = '问卷链接待补充，先扫码填写。';
    }
  }

  function openSpeak(id) {
    speakId = id || null;
    setUrlId(null);
    var ctx = $('#speakContext');
    var lead = $('#speakLead');
    var code = $('#speakCode');
    var copyBtn = $('#copyNoBtn');
    var step2 = $('#step2Desc');
    var copyBox = $('#copyBox');

    if (id) {
      ctx.innerHTML = '你正在回应 <b>#' + pad(id) + '</b>。';
      code.textContent = '#' + pad(id);
      copyBtn.hidden = false;
      copyBox.hidden = false;
      lead.textContent = QUESTIONNAIRE_URL
        ? '长按识别二维码，或点击「打开问卷」；在问卷里写上「回应 #' + pad(id) + '」和你的答案即可。'
        : '长按识别二维码，在问卷里写上「回应 #' + pad(id) + '」和你的答案即可。';
      step2.textContent = '在「想回应哪一条」里填这个编号：';
    } else {
      ctx.textContent = '想回应哪一条？先在卡片上找到它的编号；也可以直接写新的投稿。';
      code.textContent = '#____';
      copyBtn.hidden = true;
      copyBox.hidden = true;
      lead.textContent = QUESTIONNAIRE_URL
        ? '长按识别二维码，或点击「打开问卷」；在问卷里写上编号（比如 #159）或「新投稿」，再加上你的内容即可。'
        : '长按识别二维码，在问卷里写上编号（比如 #159）或「新投稿」，再加上你的内容即可。';
      step2.textContent = '在「想回应哪一条」里填编号（比如 #159）；新投稿可以写「新投稿」。';
    }

    setQuestionnaireLink();
    openModal($('#speakModal'));
  }

  /* ---------- 分享 ---------- */
  var shareTarget = null;
  var shareFile = null;
  var shareFileName = '';
  var TYPE_COLORS = {
    '提问': ['#E7F2FA', '#255F8C'],
    '倾诉': ['#E6F4F1', '#3F8C84'],
    '经验': ['#ECEFF8', '#5A6FA8'],
    '避雷': ['#FBEDE9', '#B85C4E']
  };
  var SHARE_FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Apple Color Emoji",sans-serif';

  function canvasFont(size, weight) {
    return (weight || '400') + ' ' + size + 'px ' + SHARE_FONT;
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function wrapCanvasText(ctx, text, maxWidth) {
    var out = [];
    String(text == null ? '' : text).split(/\n/).forEach(function (par) {
      par = par.replace(/\s+$/, '');
      if (!par.trim()) { out.push(''); return; }
      var line = '';
      var noStart = '，。；、！？：」』）】》,.!?;:)]}';
      for (var i = 0; i < par.length; i++) {
        var ch = par.charAt(i);
        var test = line + ch;
        if (line && ctx.measureText(test).width > maxWidth) {
          if (noStart.indexOf(ch) !== -1) {
            // 标点不单独跑到下一行开头
            out.push(test);
            line = '';
            continue;
          }
          out.push(line);
          line = ch;
        } else {
          line = test;
        }
      }
      if (line) out.push(line);
    });
    while (out.length && !out[0]) out.shift();
    while (out.length && !out[out.length - 1]) out.pop();
    return out;
  }

  function drawPill(ctx, text, x, y, font, bg, fg, stroke) {
    ctx.font = font;
    var w = ctx.measureText(text).width + 36;
    roundRect(ctx, x, y, w, 44, 10);
    ctx.fillStyle = bg;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    ctx.fillStyle = fg;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 18, y + 23);
    ctx.textBaseline = 'top';
    return w;
  }

  function drawQr(ctx, text, x, y, size) {
    var qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    var n = qr.getModuleCount();
    var margin = 4;
    var cell = size / (n + margin * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#16222E';
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (qr.isDark(r, c)) {
          ctx.fillRect(x + (c + margin) * cell, y + (r + margin) * cell, cell + 0.6, cell + 0.6);
        }
      }
    }
  }

  function fitEllipsis(ctx, line, maxWidth) {
    var ell = '……';
    if (ctx.measureText(line + ell).width <= maxWidth) return line + ell;
    var t = line;
    while (t.length && ctx.measureText(t + ell).width > maxWidth) t = t.slice(0, -1);
    return t + ell;
  }

  function serifFont(size, weight) {
    return (weight || '700') + ' ' + size + 'px "Songti SC","STSong","Noto Serif CJK SC","Source Han Serif SC",serif';
  }

  function renderShareCard(p) {
    /* 固定 3:4（1080×1440），正文最多 3 行，超出用省略号 */
    var W = 1080;
    var H = 1440;
    var M = 40;
    var PAD = 56;
    var cardW = W - M * 2;
    var innerX = M + PAD;
    var innerW = cardW - PAD * 2;
    var bodyFont = canvasFont(40, '400');
    var lineH = 68;
    var metaH = 52;
    var dividerY = 815;

    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas unavailable');
    ctx.font = bodyFont;
    var allLines = wrapCanvasText(ctx, p.text, innerW).filter(function (line) { return line.trim(); });
    var lines = allLines.slice(0, 5);
    var truncated = allLines.length > 5;
    if (truncated) lines[4] = fitEllipsis(ctx, lines[4], innerW);

    canvas.width = W;
    canvas.height = H;
    ctx = canvas.getContext('2d');

    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#F8FCFF');
    bg.addColorStop(1, '#E8F3FB');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.shadowColor = 'rgba(23,55,82,.16)';
    ctx.shadowBlur = 36;
    ctx.shadowOffsetY = 16;
    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, M, M, cardW, H - M * 2, 34);
    ctx.fill();
    ctx.restore();

    var y = M + PAD;
    var lx = innerX + 24;
    var ly = y + 26;
    ctx.fillStyle = '#3579AE';
    ctx.beginPath();
    ctx.arc(lx, ly, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.arc(lx, ly, 11, 0, Math.PI * 2);
    ctx.stroke();

    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#1E2A36';
    ctx.font = canvasFont(32, '700');
    ctx.fillText('西语SuperO', lx + 46, y + 4);
    ctx.fillStyle = '#6E8092';
    ctx.font = canvasFont(20, '400');
    ctx.fillText('树洞留言 · 西语人的温馨角落', lx + 46, y + 48);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#93A5B5';
    ctx.font = canvasFont(18, '500');
    ctx.fillText('ESPAÑOL · 树洞', innerX + innerW, y + 16);

    /* 居中栏目标识 */
    ctx.fillStyle = '#3579AE';
    roundRect(ctx, W / 2 - 28, 202, 56, 5, 2.5);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1E2A36';
    ctx.font = serifFont(68, '700');
    ctx.fillText('西语树洞', W / 2, 218);
    ctx.fillStyle = '#93A5B5';
    ctx.font = canvasFont(19, '500');
    ctx.fillText('TREEHOLE  ·  留言分享', W / 2, 306);
    ctx.textAlign = 'left';

    y = 352;
    var tc = TYPE_COLORS[p.type] || TYPE_COLORS['倾诉'];
    var w1 = drawPill(ctx, p.type, innerX, y, canvasFont(22, '700'), tc[0], tc[1]);
    drawPill(ctx, p.topic, innerX + w1 + 12, y, canvasFont(22, '600'), '#F3F8FD', '#255F8C', '#D8E9F5');
    ctx.textAlign = 'right';
    ctx.fillStyle = '#93A5B5';
    ctx.font = canvasFont(24, '500');
    ctx.fillText('#' + pad(p.id), innerX + innerW, y + 10);
    ctx.textAlign = 'left';

    y = 430;
    ctx.fillStyle = '#2C3A47';
    ctx.font = bodyFont;
    lines.forEach(function (line, i) {
      ctx.fillText(line, innerX, y + i * lineH);
    });

    ctx.strokeStyle = '#EAF1F7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(innerX, dividerY);
    ctx.lineTo(innerX + innerW, dividerY);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#1E2A36';
    ctx.font = canvasFont(30, '700');
    ctx.fillText('扫码打开这条留言', W / 2, 862);

    var qrSize = 320;
    var qrX = (W - qrSize) / 2;
    var qrY = 900;
    drawQr(ctx, cardUrl(p.id), qrX, qrY, qrSize);

    var urlText = cardUrl(p.id).replace(/^https?:\/\//, '');
    ctx.fillStyle = '#93A5B5';
    ctx.font = canvasFont(17, '400');
    ctx.fillText(urlText, W / 2, qrY + qrSize + 20);
    ctx.fillStyle = '#B0C0CD';
    ctx.font = canvasFont(18, '500');
    ctx.fillText('西语树洞 · 公众号「西语SuperO」', W / 2, qrY + qrSize + 56);
    ctx.textAlign = 'left';
    return canvas;
  }

  function openShare(id) {
    var p = byId[id];
    if (!p) return;
    shareTarget = id;
    shareFile = null;
    setUrlId(id);
    $('#shareContext').textContent = '#' + pad(id) + ' · ' + p.topic + ' · ' + p.type;
    $('#shareUrl').value = cardUrl(id);
    var img = $('#shareImage');
    var err = $('#shareError');
    var dl = $('#shareDownload');
    img.hidden = false;
    err.hidden = true;
    dl.hidden = true;
    var shareCard = $('.share-card');
    if (shareCard) shareCard.classList.remove('is-error');
    try {
      var canvas = renderShareCard(p);
      var dataUrl = canvas.toDataURL('image/png');
      img.src = dataUrl;
      img.alt = '西语树洞 #' + pad(id) + ' 留言分享图';
      shareFileName = '西语树洞-' + pad(id) + '.png';
      dl.href = dataUrl;
      dl.download = shareFileName;
      dl.hidden = IS_WECHAT;
      if (canvas.toBlob && window.File) {
        canvas.toBlob(function (blob) {
          if (!blob) return;
          try { shareFile = new File([blob], shareFileName, { type: 'image/png' }); } catch (e) {}
        }, 'image/png');
      }
    } catch (e) {
      img.hidden = true;
      img.removeAttribute('src');
      err.hidden = false;
      dl.hidden = true;
      if (shareCard) shareCard.classList.add('is-error');
    }
    $('#shareLead').textContent = IS_WECHAT
      ? '也可以选「发送给朋友」直接转发；右上角 ··· 可分享链接。'
      : '点「保存图片」下载，或复制链接发给朋友；对方扫码即可打开。';
    $('#shareLongpress').hidden = !IS_WECHAT;
    $('#shareNative').hidden = !(navigator.share && !IS_WECHAT);
    openModal($('#shareModal'));
  }

  function shareNative() {
    if (!shareTarget || !navigator.share) return;
    var p = byId[shareTarget];
    if (!p) return;
    var title = '西语树洞 #' + pad(shareTarget);
    var done = function () {
      closeModal($('#shareModal'));
      setUrlId(null);
    };
    var canFiles = false;
    try {
      canFiles = !!(shareFile && navigator.canShare && navigator.canShare({ files: [shareFile] }));
    } catch (e) {}
    if (canFiles) {
      navigator.share({ files: [shareFile], title: title }).then(done).catch(function () {});
      return;
    }
    navigator.share({
      title: title,
      text: excerpt(p.text, 70),
      url: cardUrl(shareTarget)
    }).then(done).catch(function () {});
  }

  function copyText(text, btn) {
    var done = function () {
      if (btn) {
        var old = btn.textContent;
        btn.textContent = '已复制';
        setTimeout(function () { btn.textContent = old; }, 1600);
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text); done(); });
    } else {
      fallbackCopy(text); done();
    }
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }

  /* ---------- 事件 ---------- */
  function bind() {
    $$('[data-view]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.view = btn.getAttribute('data-view');
        state.limit = 24;
        if (state.view === 'qa' && state.topic === '避雷') {
          state.topic = '全部';
          $$('.chip', $('#topicChips')).forEach(function (c) {
            c.classList.toggle('is-active', c.getAttribute('data-topic') === '全部');
          });
        }
        syncView();
        render();
        if (btn.closest('.site-header')) {
          var b = document.getElementById('browse');
          if (b) b.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    $('#topicChips').addEventListener('click', function (e) {
      var chip = e.target.closest('[data-topic]');
      if (!chip) return;
      state.topic = chip.getAttribute('data-topic');
      state.limit = 24;
      $$('.chip', $('#topicChips')).forEach(function (c) { c.classList.toggle('is-active', c === chip); });
      render();
    });

    $('#searchInput').addEventListener('input', function (e) {
      clearTimeout(searchTimer);
      var v = e.target.value;
      searchTimer = setTimeout(function () {
        state.q = v;
        state.limit = 24;
        render();
      }, 160);
    });

    function reset() {
      state.topic = '全部';
      state.q = '';
      state.view = 'posts';
      state.limit = 24;
      $('#searchInput').value = '';
      $$('.chip', $('#topicChips')).forEach(function (c) {
        c.classList.toggle('is-active', c.getAttribute('data-topic') === '全部');
      });
      syncView();
      render();
    }
    $('#emptyReset').addEventListener('click', reset);

    $('#loadMore').addEventListener('click', function () {
      state.limit += 24;
      render();
    });

    function bindGrid(grid) {
      grid.addEventListener('click', function (e) {
        var open = e.target.closest('[data-open]');
        if (open) { openDetail(open.getAttribute('data-open')); return; }
        var more = e.target.closest('[data-more]');
        if (more) {
          var card = more.closest('.card');
          card.classList.toggle('is-open');
          more.textContent = card.classList.contains('is-open') ? '收起 ↑' : '展开全文 ↓';
          return;
        }
        var share = e.target.closest('[data-share]');
        if (share) { openShare(share.getAttribute('data-share')); return; }
        var respond = e.target.closest('[data-respond]');
        if (respond) { openSpeak(respond.getAttribute('data-respond')); return; }
        var c = e.target.closest('.card');
        if (c) openDetail(c.getAttribute('data-id'));
      });
      grid.addEventListener('keydown', function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('card')) {
          e.preventDefault();
          openDetail(e.target.getAttribute('data-id'));
        }
      });
    }
    ['#grid', '#latestGrid'].forEach(function (sel) {
      var g = $(sel);
      if (g) bindGrid(g);
    });

    $('#detailContent').addEventListener('click', function (e) {
      var share = e.target.closest('[data-share]');
      if (share) { openShare(share.getAttribute('data-share')); return; }
      var respond = e.target.closest('[data-respond]');
      if (respond) {
        var id = respond.getAttribute('data-respond');
        closeModal($('#detailModal'));
        openSpeak(id);
        return;
      }
      var copy = e.target.closest('[data-copy]');
      if (copy) copyText('#' + pad(copy.getAttribute('data-copy')), copy);
    });

    $$('[data-speak]').forEach(function (b) {
      b.addEventListener('click', function () { openSpeak(null); });
    });
    $('#copyNoBtn').addEventListener('click', function () {
      if (speakId) copyText('#' + pad(speakId), $('#copyNoBtn'));
    });

    $('#shareCopy').addEventListener('click', function () {
      copyText($('#shareUrl').value, this);
    });
    $('#shareNative').addEventListener('click', shareNative);

    $$('[data-about]').forEach(function (b) {
      b.addEventListener('click', function () { openModal($('#aboutModal')); });
    });

    $$('[data-close]').forEach(function (b) {
      b.addEventListener('click', function () {
        var m = b.closest('.modal');
        closeModal(m);
        if (m && (m.id === 'detailModal' || m.id === 'shareModal')) setUrlId(null);
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeAll(); setUrlId(null); }
    });
  }

  /* ---------- 启动 ---------- */
  buildControls();
  syncView();
  bind();
  renderLatest();
  render();

  if (!PARAMS.get('demo') && PARAMS.get('id') && byId[PARAMS.get('id')]) {
    openDetail(PARAMS.get('id'));
  }

  if (PARAMS.get('scroll')) {
    setTimeout(function () { window.scrollTo(0, parseInt(PARAMS.get('scroll'), 10) || 0); }, 150);
  }

  /* 预览用：?demo=detail|speak|share|about&id=159 */
  var demo = PARAMS.get('demo');
  if (demo === 'detail') openDetail(PARAMS.get('id') || '159');
  if (demo === 'speak') openSpeak(PARAMS.get('id') || null);
  if (demo === 'share') openShare(PARAMS.get('id') || '159');
  if (demo === 'about') openModal($('#aboutModal'));
})();
