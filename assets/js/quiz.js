/* ЦГБ №3 · RMRP — движок аттестации */
(function () {
  'use strict';

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
  const LETTERS = ['а', 'б', 'в', 'г'];
  const STORE_KEY = 'cgb3.rmrp.attempts.v1';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const grid = $('#variantGrid');
  if (!grid || typeof TEST_VARIANTS === 'undefined') return;

  const viewPicker = $('#viewPicker');
  const viewQuiz = $('#viewQuiz');
  const viewResult = $('#viewResult');

  const state = {
    mode: 'exam',
    variantId: null,
    variantName: '',
    questions: [],
    index: 0,
    answers: [],
    locked: false,
    startedAt: 0
  };

  /* ---------------- хранилище ---------------- */
  function loadAttempts() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }

  function saveAttempt(attempt) {
    try {
      const list = loadAttempts();
      list.unshift(attempt);
      localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(0, 40)));
    } catch (e) { /* приватный режим — молча игнорируем */ }
  }

  function bestFor(id) {
    const list = loadAttempts().filter((a) => a.variantId === id);
    if (!list.length) return null;
    return list.reduce((best, a) => (a.score > best.score ? a : best), list[0]);
  }

  /* ---------------- выбор режима ---------------- */
  $$('.mode-switch button').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.mode = btn.dataset.mode;
      $$('.mode-switch button').forEach((b) => {
        const on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-checked', String(on));
      });
      const badge = $('#modeBadge');
      if (badge) badge.textContent = state.mode === 'train' ? 'Тренировка' : 'Экзамен';
    });
  });

  /* ---------------- быстрый старт из hero ---------------- */
  $$('[data-start]').forEach((btn) => {
    btn.addEventListener('click', () => startQuiz(btn.dataset.start));
  });

  /* ---------------- карточки вариантов ---------------- */
  const arrowSvg = '<span class="variant-card__arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>';

  function variantCard(v) {
    const best = bestFor('v' + v.id);
    const scoreHtml = best
      ? `<span class="variant-card__score"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>лучший ${best.score}/${best.total}</span>`
      : '<span class="variant-card__score is-empty">ещё не проходил</span>';

    return `
      <button class="variant-card" type="button" data-open="v${v.id}">
        <span class="variant-card__num">ВАРИАНТ ${v.id}</span>
        <span class="variant-card__tag">${v.tag}</span>
        <h3>${v.title}</h3>
        <p>${v.subtitle}</p>
        <span class="variant-card__foot">${scoreHtml}${arrowSvg}</span>
      </button>`;
  }

  grid.innerHTML = TEST_VARIANTS.map(variantCard).join('');

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('[data-open]');
    if (!card) return;
    startQuiz(card.dataset.open);
  });

  /* ---------------- экраны ---------------- */
  function showView(view) {
    [viewPicker, viewQuiz, viewResult].forEach((v) => { if (v) v.hidden = v !== view; });
    window.scrollTo({ top: Math.max(0, $('#modes').offsetTop - 100), behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  function buildQuestions(id) {
    const num = parseInt(id.replace('v', ''), 10);
    const v = TEST_VARIANTS.find((x) => x.id === num);
    return v ? v.questions.map((q) => ({ ...q, group: q.topic || 'Вариант ' + v.id })) : [];
  }

  function startQuiz(id) {
    const questions = buildQuestions(id);
    if (!questions.length) return;

    state.variantId = id;
    state.variantName = 'Вариант ' + id.replace('v', '');
    state.questions = questions;
    state.index = 0;
    state.answers = new Array(questions.length).fill(null);
    state.locked = false;
    state.startedAt = Date.now();

    if (history.replaceState) history.replaceState(null, '', '#test');
    showView(viewQuiz);
    renderQuestion();
  }

  /* ---------------- отрисовка вопроса ---------------- */
  function renderQuestion() {
    const q = state.questions[state.index];
    const total = state.questions.length;
    const picked = state.answers[state.index];

    $('#qTag').textContent = q.group || state.variantName;
    $('#qCounter').textContent = String(state.index + 1).padStart(2, '0') + ' / ' + String(total).padStart(2, '0');
    $('#qText').textContent = q.q;

    const meterFill = $('#meterFill');
    const meterText = $('#meterText');
    if (meterFill) meterFill.style.width = ((state.index + 1) / total) * 100 + '%';
    if (meterText) meterText.textContent = 'Вопрос ' + (state.index + 1) + ' из ' + total;

    const box = $('#qOptions');
    box.innerHTML = '';
    q.options.forEach((text, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'option';
      btn.dataset.index = String(i);
      btn.innerHTML = `
        <span class="option__key">${LETTERS[i]}</span>
        <span class="option__text">${text}</span>
        <span class="option__mark">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
            ${'<path d="M20 6 9 17l-5-5"/>'}
          </svg>
        </span>`;
      btn.addEventListener('click', () => selectOption(i));
      box.appendChild(btn);
    });

    const feedback = $('#qFeedback');
    feedback.hidden = true;
    feedback.classList.remove('is-bad');

    const nextBtn = $('#nextBtn');
    nextBtn.disabled = picked === null;
    nextBtn.innerHTML = state.index === total - 1
      ? 'Завершить<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
      : 'Далее<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

    if (picked !== null) applyAnswerStyles(picked, state.mode === 'train');
    state.locked = state.mode === 'train' && picked !== null;

    const card = $('#qCard');
    if (card && !reduceMotion) {
      card.style.animation = 'none';
      void card.offsetWidth;
      card.style.animation = 'viewIn .45s cubic-bezier(.16,1,.3,1)';
    }
  }

  function applyAnswerStyles(picked, showTruth) {
    const q = state.questions[state.index];
    $$('.option', $('#qOptions')).forEach((btn) => {
      const i = parseInt(btn.dataset.index, 10);
      btn.classList.toggle('is-selected', i === picked);
      if (showTruth) {
        btn.disabled = true;
        if (i === q.answer) btn.classList.add('is-correct');
        else if (i === picked && picked !== q.answer) btn.classList.add('is-wrong');
        else btn.classList.add('is-dim');
        if (i === picked && picked === q.answer) btn.querySelector('.option__mark').style.display = 'block';
      }
    });
  }

  function selectOption(i) {
    if (state.locked) return;
    const q = state.questions[state.index];
    state.answers[state.index] = i;

    if (state.mode === 'train') {
      state.locked = true;
      applyAnswerStyles(i, true);
      const feedback = $('#qFeedback');
      const ok = i === q.answer;
      feedback.hidden = false;
      feedback.classList.toggle('is-bad', !ok);
      $('#feedbackTitle').textContent = ok ? 'Верно' : 'Ошибка · правильный ответ «' + LETTERS[q.answer] + '»';
      $('#feedbackText').textContent = q.explain;
    } else {
      $$('.option', $('#qOptions')).forEach((btn) => {
        btn.classList.toggle('is-selected', parseInt(btn.dataset.index, 10) === i);
      });
    }

    $('#nextBtn').disabled = false;
  }

  /* ---------------- навигация ---------------- */
  $('#nextBtn').addEventListener('click', () => {
    if (state.answers[state.index] === null) return;
    if (state.index < state.questions.length - 1) {
      state.index += 1;
      state.locked = false;
      renderQuestion();
    } else {
      finish();
    }
  });

  $('#quitBtn').addEventListener('click', () => {
    showView(viewPicker);
    if (history.replaceState) history.replaceState(null, '', '#variants');
  });

  document.addEventListener('keydown', (e) => {
    if (viewQuiz.hidden) return;
    if (e.key >= '1' && e.key <= '4') {
      const idx = parseInt(e.key, 10) - 1;
      if (idx < state.questions[state.index].options.length) selectOption(idx);
    }
    if (e.key === 'Enter' && !$('#nextBtn').disabled) $('#nextBtn').click();
  });

  /* ---------------- результат ---------------- */
  function gradeFor(ratio) {
    if (ratio >= 0.85) {
      return {
        cls: '',
        grade: 'Допуск получен',
        title: 'Отличная работа',
        text: 'Материал знаешь уверенно: формы помощи, условия лечения и экспертизы не путаешь. Можно заступать на смену.'
      };
    }
    if (ratio >= 0.6) {
      return {
        cls: 'is-warn',
        grade: 'Зачёт с замечанием',
        title: 'Почти идеально',
        text: 'База есть, но несколько тем просели. Пробегись по разбору ошибок — и на пересдаче будет 9 из 9.'
      };
    }
    return {
      cls: 'is-bad',
      grade: 'Пересдача',
      title: 'Нужно повторить материал',
      text: 'Пока рано на смену: разбери ошибки ниже, пройди вариант в режиме тренировки и возвращайся.'
    };
  }

  function finish() {
    const total = state.questions.length;
    const score = state.questions.reduce((sum, q, i) => sum + (state.answers[i] === q.answer ? 1 : 0), 0);
    const ratio = score / total;
    const seconds = Math.max(1, Math.round((Date.now() - state.startedAt) / 1000));
    const g = gradeFor(ratio);

    showView(viewResult);

    $('#scoreValue').textContent = score + '/' + total;
    $('#resultGrade').textContent = g.grade;
    $('#resultGrade').className = 'result__grade ' + g.cls;
    $('#resultTitle').textContent = g.title;
    $('#resultText').textContent = g.text;

    $('#statCorrect').textContent = String(score);
    $('#statWrong').textContent = String(total - score);
    $('#statTime').textContent = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');

    const ring = $('#ringFill');
    if (ring) {
      const circumference = 2 * Math.PI * 88;
      ring.setAttribute('stroke-dasharray', String(circumference));
      ring.style.strokeDashoffset = String(circumference);
      requestAnimationFrame(() => {
        ring.style.strokeDashoffset = String(circumference * (1 - ratio));
      });
    }

    renderReview();
    saveAttempt({
      variantId: state.variantId,
      variantName: state.variantName,
      mode: state.mode,
      score: score,
      total: total,
      seconds: seconds,
      at: new Date().toISOString()
    });
    renderHistory();
    renderPickerScores();

    if (ratio >= 0.85) confettiBurst();
  }

  function renderReview() {
    const list = $('#reviewList');
    list.innerHTML = '';

    state.questions.forEach((q, i) => {
      const picked = state.answers[i];
      const ok = picked === q.answer;
      const item = document.createElement('div');
      item.className = 'review ' + (ok ? 'is-ok' : 'is-bad');

      item.innerHTML = `
        <button class="review__head" type="button" aria-expanded="false">
          <span class="review__status">${ok ? '✓' : '✕'}</span>
          <span class="review__q">${i + 1}. ${q.q}</span>
        </button>
        <div class="review__body"><div><div class="review__inner">
          <div class="review__row ${ok ? 'review__row--ok' : 'review__row--bad'}">Твой ответ: <b>${picked === null ? '—' : LETTERS[picked] + ') ' + q.options[picked]}</b></div>
          ${ok ? '' : `<div class="review__row review__row--ok">Правильно: <b>${LETTERS[q.answer]}) ${q.options[q.answer]}</b></div>`}
          <div class="review__explain">${q.explain}</div>
        </div></div></div>`;

      const head = $('.review__head', item);
      head.addEventListener('click', () => {
        const open = item.classList.toggle('is-open');
        head.setAttribute('aria-expanded', String(open));
      });
      list.appendChild(item);
    });

    if (list.firstElementChild) list.firstElementChild.classList.add('is-open');
    const head = list.firstElementChild && $('.review__head', list.firstElementChild);
    if (head) head.setAttribute('aria-expanded', 'true');
  }

  $('#retryBtn').addEventListener('click', () => startQuiz(state.variantId));
  $('#otherBtn').addEventListener('click', () => {
    showView(viewPicker);
    if (history.replaceState) history.replaceState(null, '', '#variants');
  });

  $('#shareBtn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const text = 'Сдал аттестацию ЦГБ №3 (RMRP): ' + $('#scoreValue').textContent + ' — ' + $('#resultGrade').textContent.toLowerCase() + '. ' + location.origin + location.pathname;
    try {
      await navigator.clipboard.writeText(text);
      const original = btn.innerHTML;
      btn.textContent = 'Скопировано ✓';
      setTimeout(() => { btn.innerHTML = original; }, 2000);
    } catch (err) {
      btn.textContent = 'Не удалось скопировать';
    }
  });

  /* ---------------- история ---------------- */
  function formatDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) + ' · ' +
      d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  function renderHistory() {
    const box = $('#historyList');
    if (!box) return;
    const list = loadAttempts().slice(0, 8);

    if (!list.length) {
      box.innerHTML = '<div class="history__empty">Пока пусто. Пройди первый вариант — результат появится здесь.</div>';
      return;
    }

    box.innerHTML = list.map((a) => {
      const ratio = a.score / a.total;
      const cls = ratio >= 0.9 ? '' : ratio >= 0.6 ? ' is-mid' : ' is-low';
      return `
        <div class="history__row">
          <span class="history__name">${a.variantName}</span>
          <span class="history__mode">${a.mode === 'train' ? 'тренировка' : 'экзамен'}</span>
          <span class="history__score${cls}">${a.score}/${a.total}</span>
          <span class="history__date">${formatDate(a.at)}</span>
        </div>`;
    }).join('');
  }

  function renderPickerScores() {
    const cards = $$('[data-open]', grid);
    cards.forEach((card) => {
      const id = card.dataset.open;
      if (!id.startsWith('v')) return;
      const best = bestFor(id);
      const slot = card.querySelector('.variant-card__foot .variant-card__score');
      if (!slot) return;
      if (best) {
        slot.classList.remove('is-empty');
        slot.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>лучший ' + best.score + '/' + best.total;
      } else {
        slot.classList.add('is-empty');
        slot.textContent = 'ещё не проходил';
      }
    });
  }

  const clearBtn = $('#clearHistory');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
      renderHistory();
      renderPickerScores();
    });
  }

  /* ---------------- конфетти ---------------- */
  function confettiBurst() {
    const canvas = $('#confetti');
    if (!canvas || reduceMotion) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);

    const colors = ['#3fe8ad', '#b8ffe6', '#ffffff', '#ffb35c', '#0fbf88'];
    const parts = Array.from({ length: 110 }, () => ({
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 260,
      y: window.innerHeight * 0.42 + (Math.random() - 0.5) * 80,
      vx: (Math.random() - 0.5) * 11,
      vy: -Math.random() * 12 - 3,
      size: 4 + Math.random() * 6,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1
    }));

    const start = performance.now();
    function frame(now) {
      const t = now - start;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      parts.forEach((p) => {
        p.vy += 0.32;
        p.vx *= 0.995;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life = Math.max(0, 1 - t / 2600);
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });
      if (t < 2600) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }
    requestAnimationFrame(frame);
  }

  /* ---------------- инициализация ---------------- */
  renderHistory();
  renderPickerScores();

  const hash = location.hash.replace('#', '');
  if (/^v[12]$/.test(hash)) startQuiz(hash);
})();
