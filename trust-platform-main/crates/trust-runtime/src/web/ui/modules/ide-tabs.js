/* ide-tabs.js — Unified IDE tab navigation: Code | Hardware | Settings | Logs.
   Manages tab switching, URL routing, keyboard shortcuts, and persistence. */

const IDE_TABS = ['code', 'hardware', 'settings', 'logs'];
const IDE_TAB_LABELS = { code: 'Code', hardware: 'Hardware', settings: 'Settings', logs: 'Logs' };
const IDE_TAB_ICONS = {
  code: '<path d="M4 5l4 3-4 3"/><path d="M10 11h4"/>',
  hardware: '<rect x="3" y="3" width="4" height="4" rx="0.5"/><rect x="9" y="3" width="4" height="4" rx="0.5"/><rect x="3" y="9" width="4" height="4" rx="0.5"/><path d="M9 11h4"/>',
  settings: '<circle cx="8" cy="8" r="2.5"/><path d="M8 2v2M8 12v2M2 8h2M12 8h2M3.8 3.8l1.4 1.4M10.8 10.8l1.4 1.4M3.8 12.2l1.4-1.4M10.8 5.2l1.4-1.4"/>',
  logs: '<path d="M3 4h10M3 7h7M3 10h9M3 13h5"/>',
};
const IDE_TAB_STORAGE_KEY = 'trust-ide-active-tab';
const IDE_TAB_CROSSFADE_MS = 150;

let ideActiveTab = null;

function ideTabInit() {
  const nav = document.getElementById('ideTabNav');
  if (!nav) return;
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-orientation', 'horizontal');

  IDE_TABS.forEach(tab => {
    const buttonId = `ideTabBtn_${tab}`;
    const btn = document.createElement('button');
    btn.id = buttonId;
    btn.type = 'button';
    btn.className = 'ide-tab-btn';
    btn.dataset.tab = tab;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', 'false');
    btn.setAttribute('tabindex', '-1');
    btn.setAttribute('aria-controls', `ideTabPanel_${tab}`);
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${IDE_TAB_ICONS[tab]}</svg><span>${IDE_TAB_LABELS[tab]}</span>`;
    btn.addEventListener('click', () => ideTabActivate(tab, true));
    nav.appendChild(btn);

    const panel = document.getElementById(`ideTabPanel_${tab}`);
    if (panel) {
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', buttonId);
      panel.setAttribute('tabindex', '0');
    }
  });

  const initial = ideTabFromUrl() || ideTabFromStorage() || 'code';
  ideTabActivate(initial, false);
  ideSetCodeTabDirty(false);

  window.addEventListener('popstate', () => {
    const tab = ideTabFromUrl() || 'code';
    ideTabActivate(tab, false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
      const digit = parseInt(e.key, 10);
      if (digit >= 1 && digit <= IDE_TABS.length) {
        const cm = document.querySelector('.cm-editor');
        if (cm && cm.contains(document.activeElement)) return;
        e.preventDefault();
        ideTabActivate(IDE_TABS[digit - 1], true);
      }
    }
  });
}

function ideTabFromUrl() {
  const path = window.location.pathname;
  for (const tab of IDE_TABS) {
    if (path === `/ide/${tab}` || path === `/ide/${tab}/`) return tab;
  }
  if (path === '/ide' || path === '/ide/') return null;
  return null;
}

function ideTabFromStorage() {
  try {
    const stored = localStorage.getItem(IDE_TAB_STORAGE_KEY);
    if (stored && IDE_TABS.includes(stored)) return stored;
  } catch (_) { /* storage unavailable */ }
  return null;
}

function ideTabActivate(tab, pushState) {
  if (!IDE_TABS.includes(tab)) tab = 'code';
  if (tab === ideActiveTab) return;

  const nav = document.getElementById('ideTabNav');
  if (nav) {
    nav.querySelectorAll('.ide-tab-btn').forEach(btn => {
      const isActive = btn.dataset.tab === tab;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
      btn.setAttribute('tabindex', isActive ? '0' : '-1');
    });
  }

  IDE_TABS.forEach(t => {
    const panel = document.getElementById(`ideTabPanel_${t}`);
    if (!panel) return;
    const isActive = t === tab;
    panel.classList.toggle('active', isActive);
    if (isActive) {
      panel.hidden = false;
      panel.setAttribute('aria-hidden', 'false');
      panel.style.opacity = '0';
      panel.style.transition = `opacity ${IDE_TAB_CROSSFADE_MS}ms ease`;
      requestAnimationFrame(() => {
        panel.style.opacity = '1';
      });
      window.setTimeout(() => {
        if (!panel.hidden) panel.style.transition = '';
      }, IDE_TAB_CROSSFADE_MS + 20);
    } else {
      panel.hidden = true;
      panel.setAttribute('aria-hidden', 'true');
      panel.style.opacity = '0';
      panel.style.transition = '';
    }
  });

  const sidebarContainers = document.querySelectorAll('[data-sidebar-tab]');
  sidebarContainers.forEach(container => {
    container.hidden = container.dataset.sidebarTab !== tab;
  });

  ideActiveTab = tab;
  const layout = document.querySelector('.ide-layout');
  if (layout) {
    layout.dataset.activeTab = tab;
  }
  if (document.body) {
    document.body.dataset.ideTab = tab;
  }

  try {
    localStorage.setItem(IDE_TAB_STORAGE_KEY, tab);
  } catch (_) { /* storage unavailable */ }

  if (pushState) {
    const url = `/ide/${tab}`;
    if (window.location.pathname !== url) {
      history.pushState({ ideTab: tab }, '', url);
    }
  }

  document.dispatchEvent(new CustomEvent('ide-tab-change', { detail: { tab } }));
}

function ideSetCodeTabDirty(isDirty) {
  const codeTab = document.getElementById('ideTabBtn_code');
  if (!codeTab) return;
  const dirty = !!isDirty;
  codeTab.dataset.dirty = dirty ? 'true' : 'false';
  codeTab.setAttribute('aria-label', dirty ? 'Code (unsaved changes)' : 'Code');
}

function ideGetActiveTab() {
  return ideActiveTab || 'code';
}

function switchIdeTab(tab) {
  ideTabActivate(tab, true);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ideTabInit);
} else {
  ideTabInit();
}
