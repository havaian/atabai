import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import router from './router';
import i18n, { getStoredLocale, setLocale, waitForI18n } from './utils/i18n';
import axiosPlugin from './plugins/axios';
import globalComponents from './plugins/globalComponents';

import './assets/main.css';
import './assets/theme.css';
import './assets/admin.css';
import './assets/mobile-overrides.css'; // Must be last - wins specificity battles.

// ── Theme init - sync, before Vue mounts, prevents flash of unstyled content ──
// Ported verbatim from the legacy main.js. Reads atabai-theme from localStorage
// and applies CSS custom properties + `data-theme` attribute + `.dark` class
// to <html> so the first paint reflects the user's preference.
(() => {
  const t = (localStorage.getItem('atabai-theme') as 'light' | 'dark' | null) || 'light';
  const el = document.documentElement;
  el.setAttribute('data-theme', t);
  if (t === 'dark') el.classList.add('dark');
  else el.classList.remove('dark');

  const dark: Record<string, string> = {
    '--ws-bg': '#0F0D18', '--ws-surface': '#171523', '--ws-surface-2': '#1D1A2A',
    '--ws-border': 'rgba(149,0,255,0.12)', '--ws-border-2': 'rgba(149,0,255,0.06)',
    '--ws-text': '#F0ECF6', '--ws-text-2': 'rgba(240,236,246,0.55)', '--ws-text-3': 'rgba(240,236,246,0.3)',
    '--ws-purple': '#7C3AED', '--ws-purple-lt': 'rgba(124,58,237,0.15)',
    '--sb-bg': '#0C0A14', '--sb-border': 'rgba(149,0,255,0.1)',
    '--sb-item-hover': 'rgba(149,0,255,0.1)', '--sb-item-active-bg': 'rgba(124,58,237,0.18)',
    '--sb-text': 'rgba(240,236,246,0.45)', '--sb-text-hover': 'rgba(240,236,246,0.85)',
    '--sb-text-active': '#C084FC', '--sb-divider': 'rgba(240,236,246,0.5)',
    '--sb-icon-muted': 'rgba(240,236,246,0.3)', '--sb-icon-hover': '#F0ECF6',
    '--sb-menu-bg': '#1A1528', '--sb-menu-border': 'rgba(149,0,255,0.15)',
    '--sb-menu-text': 'rgba(240,236,246,0.75)', '--sb-profile-border': 'rgba(149,0,255,0.08)',
    '--sb-recent-name': 'rgba(240,236,246,0.75)', '--sb-recent-meta': 'rgba(240,236,246,0.25)',
    '--sb-recent-empty': 'rgba(240,236,246,0.5)', '--sb-mobile-bg': '#0C0A14',
    '--auth-bg': '#0F0D18', '--auth-card-bg': '#171523', '--auth-card-border': 'rgba(149,0,255,0.12)',
    '--auth-card-shadow': '0 4px 24px rgba(0,0,0,0.4)', '--auth-title': '#F0ECF6', '--auth-sub': 'rgba(240,236,246,0.45)',
    '--misc-bg': '#07060B', '--misc-text': '#F0ECF6', '--misc-text-2': 'rgba(240,236,246,0.4)',
    '--misc-text-3': 'rgba(240,236,246,0.3)', '--misc-card-bg': 'rgba(255,255,255,0.03)',
    '--misc-card-border': 'rgba(255,255,255,0.07)',
    '--pill-green-bg': 'rgba(34,197,94,0.12)', '--pill-green-text': '#4ade80',
    '--pill-blue-bg': 'rgba(96,165,250,0.12)', '--pill-blue-text': '#93c5fd',
    '--pill-red-bg': 'rgba(248,113,113,0.12)', '--pill-red-text': '#fca5a5',
    '--pill-yellow-bg': 'rgba(251,191,36,0.12)', '--pill-yellow-text': '#fcd34d',
    '--pill-gray-bg': 'rgba(240,236,246,0.08)', '--pill-gray-text': 'rgba(240,236,246,0.3)',
    '--toggle-bg': 'rgba(240,236,246,0.08)', '--toggle-active-bg': '#7C3AED',
    '--toggle-icon': 'rgba(240,236,246,0.35)', '--toggle-icon-active': '#ffffff',
  };
  const light: Record<string, string> = {
    '--ws-bg': '#F4F2F9', '--ws-surface': '#FFFFFF', '--ws-surface-2': '#EDE9F7',
    '--ws-border': 'rgba(124,58,237,0.14)', '--ws-border-2': 'rgba(124,58,237,0.07)',
    '--ws-text': '#111018', '--ws-text-2': 'rgba(17,16,24,0.62)', '--ws-text-3': 'rgba(17,16,24,0.38)',
    '--ws-purple': '#7C3AED', '--ws-purple-lt': 'rgba(124,58,237,0.1)',
    '--sb-bg': '#FAF9FF', '--sb-border': 'rgba(124,58,237,0.1)',
    '--sb-item-hover': 'rgba(124,58,237,0.07)', '--sb-item-active-bg': 'rgba(124,58,237,0.1)',
    '--sb-text': 'rgba(17,16,24,0.5)', '--sb-text-hover': 'rgba(17,16,24,0.85)',
    '--sb-text-active': '#7C3AED', '--sb-divider': 'rgba(17,16,24,0.5)',
    '--sb-icon-muted': 'rgba(17,16,24,0.3)', '--sb-icon-hover': '#111018',
    '--sb-menu-bg': '#FFFFFF', '--sb-menu-border': 'rgba(124,58,237,0.15)',
    '--sb-menu-text': 'rgba(17,16,24,0.65)', '--sb-profile-border': 'rgba(17,16,24,0.08)',
    '--sb-recent-name': 'rgba(17,16,24,0.6)', '--sb-recent-meta': 'rgba(17,16,24,0.3)',
    '--sb-recent-empty': 'rgba(17,16,24,0.25)', '--sb-mobile-bg': '#FAF9FF',
    '--auth-bg': '#F4F2F9', '--auth-card-bg': '#FFFFFF', '--auth-card-border': '#E5E7EB',
    '--auth-card-shadow': '0 4px 24px rgba(0,0,0,0.06)', '--auth-title': '#111827', '--auth-sub': '#9CA3AF',
    '--misc-bg': '#F4F2F9', '--misc-text': '#111018', '--misc-text-2': 'rgba(17,16,24,0.55)',
    '--misc-text-3': 'rgba(17,16,24,0.35)', '--misc-card-bg': 'rgba(17,16,24,0.03)',
    '--misc-card-border': 'rgba(17,16,24,0.08)',
    '--pill-green-bg': 'rgba(34,197,94,0.1)', '--pill-green-text': '#15803d',
    '--pill-blue-bg': 'rgba(96,165,250,0.1)', '--pill-blue-text': '#1d4ed8',
    '--pill-red-bg': 'rgba(248,113,113,0.1)', '--pill-red-text': '#b91c1c',
    '--pill-yellow-bg': 'rgba(251,191,36,0.1)', '--pill-yellow-text': '#854d0e',
    '--pill-gray-bg': 'rgba(17,16,24,0.06)', '--pill-gray-text': 'rgba(17,16,24,0.45)',
    '--toggle-bg': 'rgba(17,16,24,0.07)', '--toggle-active-bg': '#7C3AED',
    '--toggle-icon': 'rgba(17,16,24,0.45)', '--toggle-icon-active': '#ffffff',
  };
  Object.entries(t === 'dark' ? dark : light).forEach(([k, v]) => el.style.setProperty(k, v));
})();

async function initializeApp(): Promise<void> {
  try {
    await waitForI18n();
    const pinia = createPinia();
    const app = createApp(App);
    app.use(globalComponents);
    app.use(pinia);
    app.use(router);
    app.use(i18n);
    app.use(axiosPlugin);
    setLocale(getStoredLocale());
    // Expose router globally so utils/i18n.ts's changeLocale() can swap the
    // URL's locale segment when the user picks a new language. The router
    // can't be imported there directly because that would create a circular
    // dependency (router → utils/i18n → router).
    if (typeof window !== 'undefined') {
      (window as unknown as { __VUE_ROUTER__: typeof router }).__VUE_ROUTER__ = router;
    }
    app.config.errorHandler = (err, _instance, info) => {
      console.error('[Vue]', info, err);
    };
    app.mount('#app');
  } catch (error) {
    console.error('Failed to initialize app:', error);
    // Fallback path - still try to mount so the user sees something even if
    // i18n bootstrap fails. Matches the legacy behavior.
    const pinia = createPinia();
    const app = createApp(App);
    app.use(pinia);
    app.use(router);
    app.use(i18n);
    app.use(axiosPlugin);
    if (typeof window !== 'undefined') {
      (window as unknown as { __VUE_ROUTER__: typeof router }).__VUE_ROUTER__ = router;
    }
    app.mount('#app');
  }
}

void initializeApp();
