// Motion is progressive enhancement: content and controls work without it.
const seenCards = new Set();
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
  const toggle = root.querySelector('[data-motion-toggle]');
  const animations = new Set();
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
    animations.forEach(a => a.cancel());
    animations.clear();
    document.documentElement.dataset.motion = enabled() ? 'on' : 'off';
    toggle?.setAttribute('aria-pressed', String(enabled()));
    if (toggle) {
      toggle.textContent = enabled() ? '动效 开' : '动效 关';
      toggle.disabled = reduce.matches;
      toggle.title = reduce.matches ? '已跟随系统减少动态效果设置' : '切换页面动态效果';
    }
    if (!enabled() || !('IntersectionObserver' in window)) return;
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const card = entry.target;
        observer.unobserve(card);
        if (seenCards.has(card.dataset.scene)) return;
        seenCards.add(card.dataset.scene);
        animate(card, [{ opacity: 0.3, translate: '0 16px' }, { opacity: 1, translate: '0 0' }], {
          duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)',
        });
      });
    }, { threshold: 0.08 });
    root.querySelectorAll('.skill-card').forEach(card => observer.observe(card));
  };
  toggle?.addEventListener('click', () => {
    userEnabled = !userEnabled;
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
  document.addEventListener('visibilitychange', reset, { signal });
  reduce.addEventListener('change', sync, { signal });
  fine.addEventListener('change', reset, { signal });
  sync();
  return () => {
    reset();
    observer?.disconnect();
    animations.forEach(a => a.cancel());
    controller.abort();
  };
}
