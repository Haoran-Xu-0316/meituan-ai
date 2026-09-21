// Shared selection surfaces preserve their visual position across content renders.
const groups = [
  ['navigation', '.sidebar nav', '.active'],
  ['mobile', '.mobile-nav', '.active'],
  ['category', '.category-tabs', '.selected'],
  ['status', '.segmented', '.selected'],
];
const easing = 'cubic-bezier(.22,1,.32,1)';
const reduced = () => document.documentElement.dataset.motion === 'off';
const keyOf = element => element?.getAttribute('href') || element?.dataset.value;
const boxOf = element => {
  const { left, top, width, height } = element.getBoundingClientRect();
  return { left, top, width, height };
};

export function liquidFrames(from, to) {
  if (!from || !to.width || !to.height) return null;
  const x = from.left - to.left, y = from.top - to.top;
  const horizontal = Math.abs(x) > Math.abs(y);
  return [
    { transform: `translate(${x}px, ${y}px) scale(${from.width / to.width}, ${from.height / to.height})`, offset: 0 },
    { transform: `translate(${-x * .025}px, ${-y * .025}px) scale(${horizontal ? 1.055 : .97}, ${horizontal ? .97 : 1.055})`, offset: .76 },
    { transform: 'translate(0px, 0px) scale(1, 1)', offset: 1 },
  ];
}

export function captureTransition(root) {
  const snapshot = { key: root.querySelector('main')?.dataset.transitionKey, groups: {} };
  for (const [name, selector, active] of groups) {
    const group = root.querySelector(selector), selected = group?.querySelector(active);
    if (!selected || !selected.getBoundingClientRect().width) continue;
    snapshot.groups[name] = { key: keyOf(selected), box: boxOf(group.querySelector('.liquid-indicator') || selected), scroll: group.scrollLeft };
  }
  return snapshot;
}

export function mountTransitions(root, snapshot = { groups: {} }) {
  const controller = new AbortController();
  const animations = new Set(), disclosures = new Map();
  const animate = (element, frames, options = {}) => {
    if (reduced() || !element.animate) return null;
    if (document.documentElement.dataset.sceneTransition === 'on' && !element.classList?.contains('liquid-indicator')) return null;
    const animation = element.animate(frames, { duration: 440, easing, ...options });
    animations.add(animation);
    animation.finished.catch(() => {}).finally(() => animations.delete(animation));
    return animation;
  };
  const place = (group, selected, indicator) => {
    const bounds = boxOf(group), target = boxOf(selected);
    Object.assign(indicator.style, {
      left: `${target.left - bounds.left + group.scrollLeft - group.clientLeft}px`,
      top: `${target.top - bounds.top + group.scrollTop - group.clientTop}px`,
      width: `${target.width}px`, height: `${target.height}px`,
    });
    return target;
  };
  const surfaces = [];
  for (const [name, selector, active] of groups) {
    const group = root.querySelector(selector), selected = group?.querySelector(active);
    if (!selected) {
      group?.querySelector('.liquid-indicator')?.remove();
      group?.classList.remove('liquid-group');
      continue;
    }
    const previous = snapshot.groups[name];
    if (previous && name !== 'mobile') group.scrollLeft = previous.scroll;
    const indicator = group.querySelector('.liquid-indicator') || document.createElement('span');
    indicator.className = 'liquid-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    group.append(indicator);
    group.classList.add('liquid-group');
    const target = place(group, selected, indicator);
    if (previous && previous.key !== keyOf(selected)) {
      const frames = liquidFrames(previous.box, target);
      if (frames) animate(indicator, frames);
    }
    surfaces.push(() => place(group, selected, indicator));
  }
  let resizeObserver;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => surfaces.forEach(place => place()));
    for (const [, selector] of groups) {
      const group = root.querySelector(selector);
      if (group) resizeObserver.observe(group);
    }
  }
  const main = root.querySelector('main');
  if (snapshot.key && main?.dataset.transitionKey !== snapshot.key) {
    const samePage = snapshot.key.split(':')[0] === main.dataset.transitionKey.split(':')[0];
    const content = samePage ? main.querySelector('#publish-form, .exchange-list, .empty') : main;
    if (content) animate(content, [
      { opacity: .35, ...(samePage ? { translate: '0 12px' } : {}) },
      { opacity: 1, ...(samePage ? { translate: '0 0' } : {}) },
    ], { duration: 300 });
  }
  root.addEventListener('click', event => {
    const summary = event.target.closest('summary');
    if (!summary || reduced() || event.target.closest('a, button, input')) return;
    const details = summary.parentElement;
    if (details.tagName !== 'DETAILS' || !details.animate) return;
    event.preventDefault();
    const previous = disclosures.get(details);
    const opening = previous ? !previous.opening : !details.open;
    const from = details.getBoundingClientRect().height;
    previous?.animation.cancel();
    details.open = opening;
    const to = details.getBoundingClientRect().height;
    details.open = true;
    const animation = animate(details, [{ height: `${from}px`, overflow: 'clip' }, { height: `${to}px`, overflow: 'clip' }], { duration: 320 });
    if (!animation) { details.open = opening; return; }
    disclosures.set(details, { animation, opening });
    animation.finished.then(() => {
      if (disclosures.get(details)?.animation !== animation) return;
      details.open = opening;
      disclosures.delete(details);
    }).catch(() => {});
  }, { signal: controller.signal });
  const stop = () => {
    disclosures.forEach(({ opening }, details) => { details.open = opening; });
    disclosures.clear();
    animations.forEach(animation => animation.cancel());
  };
  root.addEventListener('change', () => { if (reduced()) stop(); }, { signal: controller.signal });
  const media = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  media?.addEventListener('change', () => { if (media.matches) stop(); }, { signal: controller.signal });
  return () => {
    controller.abort();
    resizeObserver?.disconnect();
    stop();
  };
}

// Capture both UI states so existing cards move, departing content exits,
// and the browser interpolates panel geometry instead of replacing it abruptly.
export function createSceneRenderer(doc, paint) {
  let active, revision = 0;
  return (afterPaint) => {
    const current = ++revision;
    const previousKey = doc.querySelector('main')?.dataset?.transitionKey;
    active?.skipTransition();
    const update = () => {
      if (current !== revision) return;
      paint();
      const nextKey = doc.querySelector('main')?.dataset?.transitionKey;
      const backwards = previousKey?.startsWith('/publish:') && nextKey?.startsWith('/publish:') && Number(nextKey.split(':').at(-1)) < Number(previousKey.split(':').at(-1));
      doc.documentElement.style?.setProperty('--panel-direction', backwards ? '-1' : '1');
      afterPaint?.();
    };
    const finish = () => {
      if (current !== revision) return;
      doc.documentElement.dataset.sceneTransition = 'off';
      doc.documentElement.dataset.scenePhase = 'idle';
      active = null;
    };
    if (!doc.startViewTransition || !doc.querySelector('main') || doc.documentElement.dataset.motion === 'off') {
      finish(); update(); return;
    }
    doc.documentElement.dataset.sceneTransition = 'on';
    doc.documentElement.dataset.scenePhase = 'capturing';
    try {
      active = doc.startViewTransition(update);
      active.ready.then(() => {
        if (current === revision) doc.documentElement.dataset.scenePhase = 'animating';
      }).catch(() => {});
      active.finished.then(finish, finish);
    } catch {
      finish(); update();
    }
  };
}

export function nameSceneElements(root) {
  const names = [
    ['main', 'page'], ['.sidebar', 'sidebar'], ['.topbar', 'topbar'],
    ['.mobile-nav', 'mobile-bar'], ['.discovery-intro', 'hero'],
    ['.category-tabs', 'categories'], ['.segmented', 'exchange-tabs'],
    ['#publish-form', 'publish-panel'], ['.steps', 'publish-steps'],
    ['main footer', 'footer'],
  ];
  for (const [selector, name] of names) {
    const element = root.querySelector(selector);
    if (element) element.style.viewTransitionName = name;
  }
  root.querySelectorAll('.skill-card').forEach(card => {
    card.style.viewTransitionName = `skill-${card.dataset.scene}`;
  });
}


// Reading state belongs to the route, not to a render or an individual button.
const disclosureKey = details => {
  const card = details.closest('[data-scene]')?.dataset.scene || 'page';
  return card + ':' + (details.querySelector('summary')?.textContent || '').trim();
};
export function captureReadingState(root, scrollY) {
  return {
    scrollY: Math.max(0, scrollY || 0),
    disclosures: [...root.querySelectorAll('details[open]')].map(disclosureKey),
  };
}
export function restoreReadingState(root, state) {
  if (!state) return;
  const open = new Set(state.disclosures);
  root.querySelectorAll('details').forEach(details => { details.open = open.has(disclosureKey(details)); });
}
