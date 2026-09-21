// Motion is progressive enhancement: content and controls work without it.
const seenCards = new Set();
let previousCardSet = "";
const preferenceKey = 'skillpal-motion';
let userEnabled = true;
try { userEnabled = localStorage.getItem(preferenceKey) !== 'off'; } catch {}

export function pointerPose(x, y, width, height) {
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const nx = clamp(x / Math.max(1, width));
  const ny = clamp(y / Math.max(1, height));
  return { rx: (0.5 - ny) * 6, ry: (nx - 0.5) * 6, lightX: nx * 100, lightY: ny * 100 };
}

export function mountMotion(root) {
  const controller = new AbortController();
  const { signal } = controller;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const preference = root.querySelector('[data-reduce-motion]');
  const animations = new Set();
  const hero = root.querySelector('.discovery-intro');
  const cards = [...root.querySelectorAll('.skill-card')];
  const cardSet = cards.map(card => card.dataset.scene).join(',');
  const changedCollection = cardSet !== previousCardSet;
  previousCardSet = cardSet;
  let heroVisible = false, ambientObserver;
  const updateAmbient = () => {
    if (hero) hero.dataset.ambient = String(enabled() && heroVisible && !document.hidden);
  };
  let observer, frame = 0, active = null, pending = null;
  const enabled = () => userEnabled && !reduce.matches;
  const reset = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    pending = null;
    if (active) {
      active.classList.remove('is-tilting');
      for (const name of ['--tilt-x', '--tilt-y', '--light-x', '--light-y']) active.style.removeProperty(name);
    }
    active = null;
  };
  const animate = (element, keyframes, options) => {
    if (!element.animate) return;
    const animation = element.animate(keyframes, options);
    animations.add(animation);
    animation.finished.catch(() => {}).finally(() => animations.delete(animation));
  };
  const sync = () => {
    reset();
    observer?.disconnect();
    ambientObserver?.disconnect();
    animations.forEach(a => a.cancel());
    animations.clear();
    document.documentElement.dataset.motion = enabled() ? 'on' : 'off';
    if (preference) {
      preference.checked = !enabled();
      preference.disabled = reduce.matches;
      preference.title = reduce.matches ? '已跟随系统减少动态效果设置' : '减少页面动态效果';
    }
    updateAmbient();
    if (!enabled()) return;
    if (!('IntersectionObserver' in window)) return;
    if (hero) {
      ambientObserver = new IntersectionObserver(entries => {
        heroVisible = entries[0].isIntersecting;
        updateAmbient();
      }, { threshold: 0.1 });
      ambientObserver.observe(hero);
    }
    observer = new IntersectionObserver(entries => {
      entries.forEach((entry, index) => {
        if (!entry.isIntersecting) return;
        const card = entry.target;
        observer.unobserve(card);
        if (!changedCollection && seenCards.has(card.dataset.scene)) return;
        seenCards.add(card.dataset.scene);
        if (document.documentElement.dataset.sceneTransition === 'on') return;
        animate(card, [{ opacity: 0.5, translate: '0 12px', scale: '0.985' }, { opacity: 1, translate: '0 0', scale: '1' }], {
          duration: 360, delay: Math.min(index, 3) * 30, fill: 'backwards', easing: 'cubic-bezier(.16,1,.3,1)',
        });
      });
    }, { threshold: 0.08 });
    cards.forEach(card => observer.observe(card));
  };
  preference?.addEventListener('change', () => {
    userEnabled = !preference.checked;
    try { localStorage.setItem(preferenceKey, userEnabled ? 'on' : 'off'); } catch {}
    sync();
  }, { signal });
  root.addEventListener('pointermove', event => {
    if (!enabled() || !fine.matches || event.pointerType === 'touch') return;
    const target = event.target.closest('.skill-card, .discovery-intro');
    if (!target) { reset(); return; }
    if (active !== target) { reset(); active = target; }
    const rect = target.getBoundingClientRect();
    pending = pointerPose(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height);
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!active || !pending) return;
      active.classList.add('is-tilting');
      active.style.setProperty('--tilt-x', `${pending.rx}deg`);
      active.style.setProperty('--tilt-y', `${pending.ry}deg`);
      active.style.setProperty('--light-x', `${pending.lightX}%`);
      active.style.setProperty('--light-y', `${pending.lightY}%`);
    });
  }, { signal, passive: true });
  root.addEventListener('pointerout', event => {
    if (active && !active.contains(event.relatedTarget)) reset();
  }, { signal, passive: true });
  window.addEventListener('blur', reset, { signal });
  window.addEventListener('scroll', reset, { signal, passive: true });
  document.addEventListener('visibilitychange', () => { reset(); updateAmbient(); }, { signal });
  reduce.addEventListener('change', sync, { signal });
  fine.addEventListener('change', reset, { signal });
  sync();
  return () => {
    reset();
    observer?.disconnect();
    animations.forEach(a => a.cancel());
    ambientObserver?.disconnect();
    if (hero) hero.dataset.ambient = "false";
    controller.abort();
  };
}
