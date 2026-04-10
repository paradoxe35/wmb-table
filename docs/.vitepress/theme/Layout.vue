<script setup lang="ts">
import DefaultTheme from 'vitepress/theme';
import { inBrowser, useRoute } from 'vitepress';
import { onMounted, onUnmounted, watch } from 'vue';

type LocaleKey = 'root' | 'en' | 'es';

const EXPLICIT_LOCALE_COOKIE = 'wmb_docs_locale_explicit';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 5;

const route = useRoute();

function getLocaleFromPath(pathname: string): LocaleKey {
    if (/^\/en(?:\/|$)/.test(pathname)) return 'en';
    if (/^\/es(?:\/|$)/.test(pathname)) return 'es';
    return 'root';
}

function replaceLocaleInPath(pathname: string, targetLocale: LocaleKey): string {
    const currentLocale = getLocaleFromPath(pathname);
    const relativePath =
        currentLocale === 'root'
            ? pathname
            : pathname.replace(new RegExp(`^/${currentLocale}(?=/|$)`), '') || '/';

    if (targetLocale === 'root') {
        return relativePath || '/';
    }

    return relativePath === '/' ? `/${targetLocale}/` : `/${targetLocale}${relativePath}`;
}

function readCookie(name: string): string | null {
    if (!inBrowser) return null;

    const value = document.cookie
        .split('; ')
        .find((entry) => entry.startsWith(`${name}=`))
        ?.split('=')
        .slice(1)
        .join('=');

    return value ? decodeURIComponent(value) : null;
}

function writeCookie(name: string, value: string) {
    if (!inBrowser) return;

    document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`;
}

function normalizeLocale(value?: string | null): LocaleKey | null {
    const normalized = value?.trim().toLowerCase();
    if (!normalized) return null;
    if (normalized === 'root' || normalized.startsWith('fr')) return 'root';
    if (normalized.startsWith('en')) return 'en';
    if (normalized.startsWith('es')) return 'es';
    return null;
}

function getPreferredLocale(): LocaleKey {
    const explicitLocale = normalizeLocale(readCookie(EXPLICIT_LOCALE_COOKIE));
    if (explicitLocale) return explicitLocale;

    if (!inBrowser) return 'root';

    const languages = navigator.languages.length ? navigator.languages : [navigator.language];
    for (const language of languages) {
        const locale = normalizeLocale(language);
        if (locale) return locale;
    }

    return 'root';
}

function maybeRedirectToPreferredLocale() {
    if (!inBrowser) return;

    const { pathname, search, hash } = window.location;
    if (getLocaleFromPath(pathname) !== 'root') return;

    const preferredLocale = getPreferredLocale();
    if (preferredLocale === 'root') return;

    const redirectPath = replaceLocaleInPath(pathname, preferredLocale);
    const targetUrl = `${redirectPath}${search}${hash}`;
    const currentUrl = `${pathname}${search}${hash}`;

    if (targetUrl !== currentUrl) {
        window.location.replace(targetUrl);
    }
}

function handleLocaleSwitchClick(event: MouseEvent) {
    if (!inBrowser) return;

    const target = event.target;
    if (!(target instanceof Element)) return;

    const link = target.closest('a[href]');
    if (!(link instanceof HTMLAnchorElement)) return;

    if (!link.closest('.VPNavBarTranslations, .VPNavScreenTranslations')) return;

    const url = new URL(link.href, window.location.origin);
    if (url.origin !== window.location.origin) return;

    const locale = getLocaleFromPath(url.pathname);
    writeCookie(EXPLICIT_LOCALE_COOKIE, locale);
}

onMounted(() => {
    maybeRedirectToPreferredLocale();
    document.addEventListener('click', handleLocaleSwitchClick, true);
});

onUnmounted(() => {
    document.removeEventListener('click', handleLocaleSwitchClick, true);
});

watch(
    () => route.path,
    () => {
        maybeRedirectToPreferredLocale();
    },
);
</script>

<template>
    <DefaultTheme.Layout />
</template>
