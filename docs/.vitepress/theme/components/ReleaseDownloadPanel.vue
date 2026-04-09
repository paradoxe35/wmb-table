<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { UAParser } from 'ua-parser-js';

type DetectedPlatform = 'windows' | 'mac' | 'linux' | 'unknown';
type DetectedArch = 'arm64' | 'x64' | 'unknown';

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
    windows: string;
    mac: string;
    linux: string;
    notFound: string;
    more: string;
};

const props = defineProps<{
    labels: Labels;
}>();

const releasesManifestUrl = import.meta.env.VITE_RELEASES_MANIFEST_URL;

const release = ref<ReleaseManifest | null>(null);
const loading = ref(true);
const platform = ref<DetectedPlatform>('unknown');
const arch = ref<DetectedArch>('unknown');
const isUbuntu = ref(false);
const localePrefix = ref('');

function detectPlatformFromNavigator(
    userAgent: string,
    navigatorPlatform: string,
): DetectedPlatform {
    if (userAgent.includes('win') || navigatorPlatform.includes('win')) return 'windows';
    if (userAgent.includes('mac') || navigatorPlatform.includes('mac')) return 'mac';
    if (userAgent.includes('linux') || navigatorPlatform.includes('linux')) return 'linux';
    return 'unknown';
}

function detectPlatformFromOsName(osName?: string): DetectedPlatform {
    const normalized = osName?.toLowerCase() ?? '';

    if (normalized.includes('windows')) return 'windows';
    if (normalized.includes('mac')) return 'mac';
    if (normalized.includes('linux') || normalized.includes('ubuntu')) return 'linux';
    return 'unknown';
}

function detectArchFromNavigator(userAgent: string, navigatorPlatform: string): DetectedArch {
    if (
        userAgent.includes('arm64') ||
        userAgent.includes('aarch64') ||
        userAgent.includes('apple silicon') ||
        navigatorPlatform.includes('arm')
    ) {
        return 'arm64';
    }

    if (
        userAgent.includes('x64') ||
        userAgent.includes('amd64') ||
        userAgent.includes('x86_64') ||
        userAgent.includes('win64') ||
        navigatorPlatform.includes('x64') ||
        navigatorPlatform.includes('x86_64')
    ) {
        return 'x64';
    }

    return 'unknown';
}

function detectArchFromParser(architecture?: string): DetectedArch {
    const normalized = architecture?.toLowerCase() ?? '';

    if (normalized.includes('arm')) return 'arm64';
    if (
        normalized.includes('amd64') ||
        normalized.includes('x86_64') ||
        normalized.includes('x64') ||
        normalized.includes('ia64')
    ) {
        return 'x64';
    }

    return 'unknown';
}

async function detectPlatform() {
    if (typeof navigator === 'undefined') return;

    const userAgent = navigator.userAgent.toLowerCase();
    const navigatorPlatform = navigator.platform.toLowerCase();

    isUbuntu.value = userAgent.includes('ubuntu');

    try {
        let result = new UAParser().getResult();
        result = await Promise.resolve(result.withClientHints());

        const detectedPlatform = detectPlatformFromOsName(result.os.name);
        platform.value =
            detectedPlatform === 'unknown'
                ? detectPlatformFromNavigator(userAgent, navigatorPlatform)
                : detectedPlatform;

        arch.value = detectArchFromParser(result.cpu.architecture);
        if (arch.value === 'unknown') {
            arch.value = detectArchFromNavigator(userAgent, navigatorPlatform);
        }
    } catch {
        platform.value = detectPlatformFromNavigator(userAgent, navigatorPlatform);
        arch.value = detectArchFromNavigator(userAgent, navigatorPlatform);
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

function firstArchMatch(
    assets: ReleaseAsset[],
    preferredArch: DetectedArch | undefined,
    test: (asset: ReleaseAsset) => boolean,
) {
    if (!preferredArch || preferredArch === 'unknown') return null;
    return firstMatch(assets, (asset) => asset.arch === preferredArch && test(asset));
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

function assetExtension(asset: ReleaseAsset): string {
    const lower = asset.name.toLowerCase();
    return lower.endsWith('.tar.gz')
        ? 'tar.gz'
        : (asset.name.split('.').pop()?.toLowerCase() ?? '');
}

function assetLabel(asset: ReleaseAsset): string {
    const extension = assetExtension(asset);

    if (asset.platform === 'windows') {
        if (extension === 'exe') return 'Windows Installer';
        if (extension === 'zip') return 'Windows Portable ZIP';
    }

    if (asset.platform === 'mac') {
        if (extension === 'dmg' || extension === 'zip') {
            return asset.arch === 'arm64' ? 'macOS Apple Silicon' : 'macOS Intel';
        }
    }

    if (asset.platform === 'linux') {
        if (extension === 'appimage') return 'Linux AppImage';
        if (extension === 'deb') return 'Linux DEB Package';
        if (extension === 'tar.gz') return 'Linux TAR.GZ Archive';
    }

    return asset.name;
}

function assetMeta(asset: ReleaseAsset): string {
    return [assetLabel(asset), formatSize(asset.sizeBytes)].filter(Boolean).join(' • ');
}

function normalizePlatformAssets(target: 'windows' | 'mac' | 'linux', assets: ReleaseAsset[]) {
    if (target !== 'mac') return assets;

    return assets.filter((asset) => {
        if (assetExtension(asset) !== 'zip') return true;

        return !assets.some(
            (candidate) => candidate.arch === asset.arch && assetExtension(candidate) === 'dmg',
        );
    });
}

function preferredAssetForPlatform(
    target: 'windows' | 'mac' | 'linux',
    assets: ReleaseAsset[],
    options: {
        preferredArch?: DetectedArch;
        preferUbuntu?: boolean;
    } = {},
) {
    const platformAssets = assets.filter((asset) => asset.platform === target);
    if (!platformAssets.length) return null;

    if (target === 'windows') {
        return (
            firstArchMatch(
                platformAssets,
                options.preferredArch,
                (asset) => asset.kind === 'installer',
            ) ??
            firstArchMatch(platformAssets, options.preferredArch, () => true) ??
            firstMatch(platformAssets, (asset) => asset.kind === 'installer') ??
            firstMatch(platformAssets, () => true)
        );
    }

    if (target === 'mac') {
        return (
            firstArchMatch(
                platformAssets,
                options.preferredArch,
                (asset) => asset.kind === 'installer',
            ) ??
            firstArchMatch(platformAssets, options.preferredArch, () => true) ??
            firstMatch(platformAssets, (asset) => asset.kind === 'installer') ??
            firstMatch(platformAssets, () => true)
        );
    }

    return (
        (options.preferUbuntu
            ? firstArchMatch(platformAssets, options.preferredArch, (asset) =>
                  asset.name.toLowerCase().endsWith('.deb'),
              )
            : null) ??
        (options.preferUbuntu
            ? firstMatch(platformAssets, (asset) => asset.name.toLowerCase().endsWith('.deb'))
            : null) ??
        firstArchMatch(platformAssets, options.preferredArch, (asset) =>
            asset.name.toLowerCase().endsWith('.appimage'),
        ) ??
        firstMatch(platformAssets, (asset) => asset.name.toLowerCase().endsWith('.appimage')) ??
        firstArchMatch(platformAssets, options.preferredArch, (asset) =>
            asset.name.toLowerCase().endsWith('.deb'),
        ) ??
        firstMatch(platformAssets, (asset) => asset.name.toLowerCase().endsWith('.deb')) ??
        firstArchMatch(platformAssets, options.preferredArch, (asset) =>
            asset.name.toLowerCase().endsWith('.tar.gz'),
        ) ??
        firstMatch(platformAssets, (asset) => asset.name.toLowerCase().endsWith('.tar.gz')) ??
        firstArchMatch(platformAssets, options.preferredArch, () => true) ??
        firstMatch(platformAssets, () => true)
    );
}

const recommendedAsset = computed(() => {
    const assets = release.value?.assets ?? [];
    if (!assets.length) return null;
    return platform.value === 'unknown'
        ? null
        : preferredAssetForPlatform(platform.value, assets, {
              preferredArch: arch.value,
              preferUbuntu: isUbuntu.value,
          });
});

const platformCards = computed(() => {
    const assets = release.value?.assets ?? [];

    return [
        {
            key: 'windows' as const,
            title: props.labels.windows,
            items: assets.filter((asset) => asset.platform === 'windows'),
        },
        {
            key: 'mac' as const,
            title: props.labels.mac,
            items: assets.filter((asset) => asset.platform === 'mac'),
        },
        {
            key: 'linux' as const,
            title: props.labels.linux,
            items: assets.filter((asset) => asset.platform === 'linux'),
        },
    ].map((entry) => {
        const visibleItems = normalizePlatformAssets(entry.key, entry.items);
        const primary = preferredAssetForPlatform(entry.key, visibleItems);
        const extras = primary ? visibleItems.filter((asset) => asset.name !== primary.name) : [];

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
    void detectPlatform();
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
                        <div class="release-panel__title-row">
                            <h2>{{ labels.title }}</h2>
                            <span class="release-panel__version">{{ release.version }}</span>
                        </div>
                        <div v-if="recommendedAsset" class="release-panel__download-row">
                            <a class="release-panel__cta" :href="recommendedAsset.url">
                                {{ labels.downloading }}
                            </a>
                            <div class="release-panel__helper">
                                <span class="release-panel__meta">{{
                                    assetMeta(recommendedAsset)
                                }}</span>
                                <span v-if="installGuideHref" class="release-panel__helper-sep"
                                    >•</span
                                >
                                <a
                                    v-if="installGuideHref"
                                    class="release-panel__install-link"
                                    :href="installGuideHref"
                                >
                                    {{ labels.installLink }}
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="release-panel__grid">
                    <article
                        v-for="card in platformCards"
                        :key="card.key"
                        class="release-panel__card"
                    >
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
                                    <a
                                        v-for="asset in card.extras"
                                        :key="asset.name"
                                        class="release-panel__link"
                                        :href="asset.url"
                                    >
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
    </section>
</template>
