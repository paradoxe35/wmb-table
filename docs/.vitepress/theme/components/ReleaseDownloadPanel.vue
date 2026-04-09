<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

type ReleaseAsset = {
    name: string;
    url: string;
    platform: 'windows' | 'mac' | 'linux' | 'other';
    arch: 'arm64' | 'x64' | 'unknown';
    kind: 'installer' | 'package' | 'portable' | 'download';
};

type ReleaseManifest = {
    version: string;
    assets: ReleaseAsset[];
};

type Labels = {
    title: string;
    loading: string;
    downloading: string;
    fallback: string;
    all: string;
    version: string;
    windows: string;
    mac: string;
    linux: string;
    direct: string;
    recommended: string;
    notFound: string;
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

function detectPlatform() {
    if (typeof navigator === 'undefined') return;
    const ua = navigator.userAgent.toLowerCase();
    const plt = navigator.platform.toLowerCase();

    if (ua.includes('win') || plt.includes('win')) platform.value = 'windows';
    else if (ua.includes('mac') || plt.includes('mac')) platform.value = 'mac';
    else if (ua.includes('linux') || plt.includes('linux')) platform.value = 'linux';

    if (ua.includes('arm64') || ua.includes('aarch64') || ua.includes('apple silicon')) {
        arch.value = 'arm64';
    } else if (plt.includes('arm')) {
        arch.value = 'arm64';
    }
}

function firstMatch(assets: ReleaseAsset[], test: (asset: ReleaseAsset) => boolean) {
    return assets.find(test) ?? null;
}

const recommendedAsset = computed(() => {
    const assets = release.value?.assets ?? [];
    if (!assets.length) return null;

    if (platform.value === 'windows') {
        return (
            firstMatch(assets, (a) => a.platform === 'windows' && a.kind === 'installer' && a.arch === 'x64') ??
            firstMatch(assets, (a) => a.platform === 'windows' && a.kind === 'installer') ??
            firstMatch(assets, (a) => a.platform === 'windows' && a.kind === 'portable')
        );
    }

    if (platform.value === 'mac') {
        return (
            firstMatch(assets, (a) => a.platform === 'mac' && a.kind === 'installer' && a.arch === arch.value) ??
            firstMatch(assets, (a) => a.platform === 'mac' && a.kind === 'installer') ??
            firstMatch(assets, (a) => a.platform === 'mac' && a.kind === 'portable' && a.arch === arch.value) ??
            firstMatch(assets, (a) => a.platform === 'mac' && a.kind === 'portable')
        );
    }

    if (platform.value === 'linux') {
        return (
            firstMatch(assets, (a) => a.platform === 'linux' && a.name.toLowerCase().endsWith('.appimage')) ??
            firstMatch(assets, (a) => a.platform === 'linux' && a.name.toLowerCase().endsWith('.deb')) ??
            firstMatch(assets, (a) => a.platform === 'linux' && a.name.toLowerCase().endsWith('.tar.gz'))
        );
    }

    return null;
});

const manualGroups = computed(() => {
    const assets = release.value?.assets ?? [];
    return {
        windows: assets.filter((a) => a.platform === 'windows'),
        mac: assets.filter((a) => a.platform === 'mac'),
        linux: assets.filter((a) => a.platform === 'linux'),
    };
});

onMounted(async () => {
    detectPlatform();
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
        <div class="home-section-head">
            <h2>{{ labels.title }}</h2>
        </div>

        <div class="release-panel__box">
            <div v-if="loading" class="release-panel__status">
                {{ labels.loading }}
            </div>

            <template v-else-if="release">
                <div class="release-panel__hero">
                    <div>
                        <div class="release-panel__badge">{{ labels.version }} {{ release.version }}</div>
                        <h3>{{ labels.recommended }}</h3>
                        <p v-if="recommendedAsset">{{ recommendedAsset.name }}</p>
                        <p v-else>{{ labels.notFound }}</p>
                    </div>
                    <a
                        v-if="recommendedAsset"
                        class="release-panel__cta"
                        :href="recommendedAsset.url"
                    >
                        {{ labels.downloading }}
                    </a>
                </div>

                <div class="release-panel__grid">
                    <div class="release-panel__card">
                        <h4>{{ labels.windows }}</h4>
                        <a
                            v-for="asset in manualGroups.windows"
                            :key="asset.name"
                            class="release-panel__link"
                            :href="asset.url"
                        >
                            {{ asset.name }}
                        </a>
                    </div>
                    <div class="release-panel__card">
                        <h4>{{ labels.mac }}</h4>
                        <a
                            v-for="asset in manualGroups.mac"
                            :key="asset.name"
                            class="release-panel__link"
                            :href="asset.url"
                        >
                            {{ asset.name }}
                        </a>
                    </div>
                    <div class="release-panel__card">
                        <h4>{{ labels.linux }}</h4>
                        <a
                            v-for="asset in manualGroups.linux"
                            :key="asset.name"
                            class="release-panel__link"
                            :href="asset.url"
                        >
                            {{ asset.name }}
                        </a>
                    </div>
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
