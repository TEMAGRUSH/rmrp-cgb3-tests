/* Тесты ЦГБ №3 · RMRP — интерфейсные эффекты */
(function () {
  'use strict';

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- шапка, прогресс, кнопка «наверх» ---------- */
  const header = $('#header');
  const progress = $('#scrollProgress');
  const toTop = $('#toTop');

  function onScroll() {
    const y = window.scrollY;
    if (header) header.classList.toggle('is-scrolled', y > 24);
    if (toTop) toTop.classList.toggle('is-visible', y > 600);
    if (progress) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (toTop) {
    toTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  /* ---------- мобильное меню ---------- */
  const burger = $('#burger');
  const mobileMenu = $('#mobileMenu');

  function closeMenu() {
    if (!burger || !mobileMenu) return;
    burger.classList.remove('is-open');
    mobileMenu.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  if (burger && mobileMenu) {
    burger.addEventListener('click', () => {
      const open = !mobileMenu.classList.contains('is-open');
      burger.classList.toggle('is-open', open);
      mobileMenu.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
    });
    $$('a', mobileMenu).forEach((a) => a.addEventListener('click', closeMenu));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
  }

  /* ---------- появление блоков ---------- */
  const revealEls = $$('[data-reveal]');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach((el) => io.observe(el));
  }

  /* ---------- свечение за курсором ---------- */
  const glow = $('#cursorGlow');
  if (glow && window.matchMedia('(pointer: fine)').matches && !reduceMotion) {
    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 3;
    let cx = tx;
    let cy = ty;
    document.body.classList.add('has-pointer');

    window.addEventListener('pointermove', (e) => {
      tx = e.clientX;
      ty = e.clientY;
    }, { passive: true });

    (function loop() {
      cx += (tx - cx) * 0.09;
      cy += (ty - cy) * 0.09;
      glow.style.transform = 'translate3d(' + cx + 'px, ' + cy + 'px, 0)';
      requestAnimationFrame(loop);
    })();
  }

  /* ---------- плавный скролл по якорям с учётом шапки ---------- */
  $$('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 92;
      window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  });

  /* ---------- заказ сайта: копирование ника и плавающая кнопка ---------- */
  const toastEl = $('#toast');
  let toastTimer;

  function showToast(text) {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 2600);
  }

  $$('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const value = btn.dataset.copy;
      try {
        await navigator.clipboard.writeText(value);
      } catch (err) {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) { /* noop */ }
        ta.remove();
      }
      showToast('Ник скопирован: ' + value);
    });
  });

  const fab = $('#promoFab');
  const orderSection = $('#order');
  if (fab) {
    const syncFab = () => {
      const scrolled = window.scrollY > 420;
      const orderVisible = orderSection
        ? orderSection.getBoundingClientRect().top < window.innerHeight * 0.9
        : false;
      fab.classList.toggle('is-on', scrolled && !orderVisible);
    };
    syncFab();
    window.addEventListener('scroll', syncFab, { passive: true });
    window.addEventListener('resize', syncFab);

    fab.addEventListener('click', () => {
      const target = orderSection || $('#variants');
      if (!target) return;
      const top = target.getBoundingClientRect().top + window.scrollY - 92;
      window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }
})();
