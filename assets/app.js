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

  var TOPICS = ['全部'].concat(META.topics || []);
  if (TOPICS.indexOf('避雷') === -1) TOPICS.push('避雷');
  var TYPE_CLASS = { '提问': 'question', '倾诉': 'vent', '经验': 'exp', '避雷': 'warn' };
  var TOPIC_CLASS = {
    '学习考证': 'study', '考研升学': 'kaoyan', '留学交换': 'abroad', '外派海外': 'overseas',
    '求职就业': 'job', 'Offer 选择': 'offer', '考公体制': 'gov', '校园生活': 'campus'
  };

  var state = { view: 'posts', topic: '全部', q: '', limit: 24 };
  var PARAMS = new URLSearchParams(location.search);
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
      if (state.view === 'qa') {
        qa.textContent = '← 回到全部留言';
        qa.setAttribute('data-view', 'posts');
      } else {
        qa.textContent = '点击这里，查看西语人的疑问+困惑，期待你的解答和建议~';
        qa.setAttribute('data-view', 'qa');
      }
    }
    var title = $('#browseTitle');
    if (title) title.textContent = state.view === 'qa' ? '大家的提问' : '翻一翻留言';
    var bail = document.querySelector('[data-topic="避雷"]');
    if (bail) bail.hidden = state.view === 'qa';
  }

  function buildControls() {
    $('#topicChips').innerHTML = TOPICS.map(function (t) {
      return '<button class="chip' + (t === state.topic ? ' is-active' : '') + '" data-topic="' + esc(t) + '">' + esc(t) + '</button>';
    }).join('');
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
    html += '<button class="respond-btn" data-respond="' + p.id + '">回应这条</button>';
    html += '</div>';
    html += '</article>';
    return html;
  }

  function render() {
    var list = filtered();
    var shown = list.slice(0, state.limit);
    var grid = $('#grid');

    grid.innerHTML = shown.map(cardHTML).join('');

    $$('.card', grid).forEach(function (card) {
      var text = $('.card-text', card);
      if (!text) return;
      var long = text.scrollHeight > text.clientHeight + 4 || text.textContent.length > 230;
      if (long) card.classList.add('is-long');
    });

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
    html += '<button class="btn btn-ghost" data-copy="' + p.id + '">复制编号</button>';
    html += '</div>';

    $('#detailContent').innerHTML = html;
    openModal($('#detailModal'));
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

    var grid = $('#grid');
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

    $('#detailContent').addEventListener('click', function (e) {
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

    $$('[data-about]').forEach(function (b) {
      b.addEventListener('click', function () { openModal($('#aboutModal')); });
    });

    $$('[data-close]').forEach(function (b) {
      b.addEventListener('click', function () { closeModal(b.closest('.modal')); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAll();
    });
  }

  /* ---------- 启动 ---------- */
  buildControls();
  syncView();
  bind();
  render();

  if (PARAMS.get('scroll')) {
    setTimeout(function () { window.scrollTo(0, parseInt(PARAMS.get('scroll'), 10) || 0); }, 150);
  }

  /* 预览用：?demo=detail|speak|about&id=159 */
  var demo = PARAMS.get('demo');
  if (demo === 'detail') openDetail(PARAMS.get('id') || '159');
  if (demo === 'speak') openSpeak(PARAMS.get('id') || null);
  if (demo === 'about') openModal($('#aboutModal'));
})();
