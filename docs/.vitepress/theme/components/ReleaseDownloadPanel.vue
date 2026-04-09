<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

type ReleaseAsset = {
    name: string;
    url: string;
    platform: 'windows' | 'mac' | 'linux' | 'other';
    arch: 'arm64' | 'x64' | 'unknown';
    kind: 'installer' | 'package' | 'portable' | 'download';
    sizeBytes: number;
};

type ReleaseManifest = {
    version: string;
    assets: ReleaseAsset[];
};

type Labels = {
    title: string;
    loading: string;
    downloading: string;
    installLink: string;
    fallback: string;
    version: string;
    windows: string;
    mac: string;
    linux: string;
    notFound: string;
    more: string;
    forThisDevice: string;
    installTitle: string;
    installWindows: string;
    installMac: string;
    installLinux: string;
};

const props = defineProps<{
    labels: Labels;
}>();

const releasesManifestUrl = import.meta.env.VITE_RELEASES_MANIFEST_URL;

const release = ref<ReleaseManifest | null>(null);
const loading = ref(true);
const platform = ref<'windows' | 'mac' | 'linux' | 'unknown'>('unknown');
const arch = ref<'arm64' | 'x64'>('x64');
const isUbuntu = ref(false);
const localePrefix = ref('');

function detectPlatform() {
    if (typeof navigator === 'undefined') return;
    const ua = navigator.userAgent.toLowerCase();
    const plt = navigator.platform.toLowerCase();

    if (ua.includes('win') || plt.includes('win')) platform.value = 'windows';
    else if (ua.includes('mac') || plt.includes('mac')) platform.value = 'mac';
    else if (ua.includes('linux') || plt.includes('linux')) platform.value = 'linux';

    isUbuntu.value = ua.includes('ubuntu');

    if (ua.includes('arm64') || ua.includes('aarch64') || ua.includes('apple silicon')) {
        arch.value = 'arm64';
    } else if (plt.includes('arm')) {
        arch.value = 'arm64';
    }
}

function detectLocalePrefix() {
    if (typeof window === 'undefined') return;
    const pathname = window.location.pathname;
    if (pathname.startsWith('/en/')) localePrefix.value = '/en';
    else if (pathname.startsWith('/es/')) localePrefix.value = '/es';
    else localePrefix.value = '';
}

function firstMatch(assets: ReleaseAsset[], test: (asset: ReleaseAsset) => boolean) {
    return assets.find(test) ?? null;
}

function formatSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }

    const digits = value >= 100 || unitIndex === 0 ? 0 : 1;
    return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

function assetLabel(asset: ReleaseAsset): string {
    const lower = asset.name.toLowerCase();
    const extension =
        lower.endsWith('.tar.gz')
            ? 'tar.gz'
            : asset.name.split('.').pop()?.toLowerCase() ?? '';

    if (asset.platform === 'windows') {
        if (extension === 'exe') return 'Windows Installer';
        if (extension === 'zip') return 'Windows Portable ZIP';
    }

    if (asset.platform === 'mac') {
        if (extension === 'dmg') return asset.arch === 'arm64' ? 'macOS Apple Silicon DMG' : 'macOS Intel DMG';
        if (extension === 'zip') return asset.arch === 'arm64' ? 'macOS Apple Silicon ZIP' : 'macOS Intel ZIP';
    }

    if (asset.platform === 'linux') {
        if (extension === 'appimage') return 'Linux AppImage';
        if (extension === 'deb') return 'Linux DEB package';
        if (extension === 'tar.gz') return 'Linux tar.gz archive';
    }

    return asset.name;
}

function assetMeta(asset: ReleaseAsset): string {
    return [assetLabel(asset), formatSize(asset.sizeBytes)].filter(Boolean).join(' • ');
}

function preferredAssetForPlatform(target: 'windows' | 'mac' | 'linux', assets: ReleaseAsset[]) {
    if (target === 'windows') {
        return (
            firstMatch(assets, (a) => a.platform === 'windows' && a.kind === 'installer') ??
            firstMatch(assets, (a) => a.platform === 'windows')
        );
    }

    if (target === 'mac') {
        return (
            firstMatch(assets, (a) => a.platform === 'mac' && a.kind === 'installer' && a.arch === 'arm64') ??
            firstMatch(assets, (a) => a.platform === 'mac' && a.kind === 'installer') ??
            firstMatch(assets, (a) => a.platform === 'mac')
        );
    }

    return (
        (isUbuntu.value
            ? firstMatch(assets, (a) => a.platform === 'linux' && a.name.toLowerCase().endsWith('.deb'))
            : null) ??
        firstMatch(assets, (a) => a.platform === 'linux' && a.name.toLowerCase().endsWith('.appimage')) ??
        firstMatch(assets, (a) => a.platform === 'linux' && a.name.toLowerCase().endsWith('.deb')) ??
        firstMatch(assets, (a) => a.platform === 'linux')
    );
}

const recommendedAsset = computed(() => {
    const assets = release.value?.assets ?? [];
    if (!assets.length) return null;

    if (platform.value === 'windows') {
        return (
            firstMatch(assets, (a) => a.platform === 'windows' && a.kind === 'installer') ??
            firstMatch(assets, (a) => a.platform === 'windows')
        );
    }

    if (platform.value === 'mac') {
        return (
            firstMatch(assets, (a) => a.platform === 'mac' && a.kind === 'installer' && a.arch === arch.value) ??
            firstMatch(assets, (a) => a.platform === 'mac' && a.kind === 'installer') ??
            firstMatch(assets, (a) => a.platform === 'mac')
        );
    }

    if (platform.value === 'linux') {
        return (
            (isUbuntu.value
                ? firstMatch(assets, (a) => a.platform === 'linux' && a.name.toLowerCase().endsWith('.deb'))
                : null) ??
            firstMatch(assets, (a) => a.platform === 'linux' && a.name.toLowerCase().endsWith('.appimage')) ??
            firstMatch(assets, (a) => a.platform === 'linux' && a.name.toLowerCase().endsWith('.deb')) ??
            firstMatch(assets, (a) => a.platform === 'linux')
        );
    }

    return null;
});

const platformCards = computed(() => {
    const assets = release.value?.assets ?? [];

    return [
        { key: 'windows' as const, title: props.labels.windows, items: assets.filter((asset) => asset.platform === 'windows') },
        { key: 'mac' as const, title: props.labels.mac, items: assets.filter((asset) => asset.platform === 'mac') },
        { key: 'linux' as const, title: props.labels.linux, items: assets.filter((asset) => asset.platform === 'linux') },
    ].map((entry) => {
        const primary = preferredAssetForPlatform(entry.key, entry.items);
        const extras = primary ? entry.items.filter((asset) => asset.name !== primary.name) : [];

        return {
            ...entry,
            primary,
            extras,
        };
    });
});

const installGuideHref = computed(() => {
    const anchor =
        platform.value === 'windows'
            ? '#windows'
            : platform.value === 'mac'
              ? '#macos'
              : platform.value === 'linux'
                ? '#linux'
                : '';

    if (!anchor) return '';
    return `${localePrefix.value}/guide/installation${anchor}`;
});

onMounted(async () => {
    detectPlatform();
    detectLocalePrefix();
    try {
        if (!releasesManifestUrl) {
            throw new Error('Missing VITE_RELEASES_MANIFEST_URL');
        }

        const res = await fetch(releasesManifestUrl, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Release manifest error ${res.status}`);
        release.value = (await res.json()) as ReleaseManifest;
    } catch {
        release.value = null;
    } finally {
        loading.value = false;
    }
});
</script>

<template>
    <section id="download" class="release-panel">
        <div class="release-panel__box">
            <div v-if="loading" class="release-panel__status">
                {{ labels.loading }}
            </div>

            <template v-else-if="release">
                <div class="release-panel__hero">
                    <div class="release-panel__lead">
                        <div class="release-panel__badge">{{ labels.version }} {{ release.version }}</div>
                        <h2>{{ labels.title }}</h2>
                    </div>

                    <div v-if="recommendedAsset" class="release-panel__action">
                        <a class="release-panel__cta" :href="recommendedAsset.url">
                            {{ labels.downloading }}
                        </a>
                    </div>
                </div>

                <div v-if="recommendedAsset" class="release-panel__subline">
                    <div class="release-panel__meta">{{ assetMeta(recommendedAsset) }}</div>
                    <a v-if="installGuideHref" class="release-panel__install-link" :href="installGuideHref">
                        {{ labels.installLink }}
                    </a>
                </div>

                <div class="release-panel__grid">
                    <article v-for="card in platformCards" :key="card.key" class="release-panel__card">
                        <div class="release-panel__card-head">
                            <h3>{{ card.title }}</h3>
                        </div>

                        <template v-if="card.primary">
                            <a class="release-panel__primary-link" :href="card.primary.url">
                                <span>{{ assetLabel(card.primary) }}</span>
                                <small>{{ formatSize(card.primary.sizeBytes) }}</small>
                            </a>

                            <details v-if="card.extras.length" class="release-panel__details">
                                <summary>{{ labels.more }}</summary>
                                <div class="release-panel__list">
                                    <a v-for="asset in card.extras" :key="asset.name" class="release-panel__link"
                                        :href="asset.url">
                                        <span>{{ assetLabel(asset) }}</span>
                                        <small>{{ formatSize(asset.sizeBytes) }}</small>
                                    </a>
                                </div>
                            </details>
                        </template>

                        <p v-else class="release-panel__empty">{{ labels.notFound }}</p>
                    </article>
                </div>
            </template>

            <template v-else>
                <div class="release-panel__status">
                    {{ labels.fallback }}
                </div>
            </template>
        </div>

        <div class="doc-overview-grid release-install-grid">
            <div class="doc-overview-card">
                <h3>{{ labels.installTitle }}</h3>
                <p>{{ labels.installWindows }}</p>
            </div>
            <div class="doc-overview-card">
                <h3>macOS</h3>
                <p>{{ labels.installMac }}</p>
            </div>
            <div class="doc-overview-card">
                <h3>Linux</h3>
                <p>{{ labels.installLinux }}</p>
            </div>
        </div>
    </section>
</template>
