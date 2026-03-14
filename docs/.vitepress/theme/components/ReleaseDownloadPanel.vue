<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

type ReleaseAsset = {
    name: string;
    browser_download_url: string;
};

type ReleaseInfo = {
    tag_name: string;
    html_url: string;
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

const githubOwner = import.meta.env.VITE_GITHUB_OWNER || 'paradoxe35';
const githubRepo = import.meta.env.VITE_GITHUB_REPO || 'wmb-table';
const githubReleasesUrl = `https://github.com/${githubOwner}/${githubRepo}/releases`;
const githubLatestReleaseApiUrl = `https://api.github.com/repos/${githubOwner}/${githubRepo}/releases/latest`;

const release = ref<ReleaseInfo | null>(null);
const loading = ref(true);
const platform = ref<'windows' | 'mac' | 'linux' | 'unknown'>('unknown');
const arch = ref<'arm64' | 'x64'>('x64');

function normalize(name: string): string {
    return name.toLowerCase();
}

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

function hasArch(name: string, wanted: 'arm64' | 'x64') {
    const n = normalize(name);
    if (wanted === 'arm64') return /arm64|aarch64/.test(n);
    return /x64|amd64|x86_64/.test(n) || !/arm64|aarch64/.test(n);
}

function firstMatch(assets: ReleaseAsset[], test: (asset: ReleaseAsset) => boolean) {
    return assets.find(test) ?? null;
}

const recommendedAsset = computed(() => {
    const assets = release.value?.assets ?? [];
    if (!assets.length) return null;

    if (platform.value === 'windows') {
        return (
            firstMatch(assets, (a) => /\.exe$/i.test(a.name) && hasArch(a.name, 'x64')) ??
            firstMatch(assets, (a) => /\.exe$/i.test(a.name)) ??
            firstMatch(assets, (a) => /\.zip$/i.test(a.name))
        );
    }

    if (platform.value === 'mac') {
        return (
            firstMatch(assets, (a) => /\.dmg$/i.test(a.name) && hasArch(a.name, arch.value)) ??
            firstMatch(assets, (a) => /\.dmg$/i.test(a.name)) ??
            firstMatch(assets, (a) => /\.zip$/i.test(a.name) && hasArch(a.name, arch.value))
        );
    }

    if (platform.value === 'linux') {
        return (
            firstMatch(assets, (a) => /\.appimage$/i.test(a.name)) ??
            firstMatch(assets, (a) => /\.deb$/i.test(a.name)) ??
            firstMatch(assets, (a) => /\.tar\.gz$/i.test(a.name))
        );
    }

    return null;
});

const manualGroups = computed(() => {
    const assets = release.value?.assets ?? [];
    return {
        windows: assets.filter((a) => /\.(exe|zip)$/i.test(a.name)),
        mac: assets.filter((a) => /\.(dmg|zip)$/i.test(a.name)),
        linux: assets.filter((a) => /\.(appimage|deb|tar\.gz)$/i.test(a.name)),
    };
});

onMounted(async () => {
    detectPlatform();
    try {
        const res = await fetch(githubLatestReleaseApiUrl);
        if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
        release.value = (await res.json()) as ReleaseInfo;
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
                        <div class="release-panel__badge">{{ labels.version }} {{ release.tag_name }}</div>
                        <h3>{{ labels.recommended }}</h3>
                        <p v-if="recommendedAsset">{{ recommendedAsset.name }}</p>
                        <p v-else>{{ labels.notFound }}</p>
                    </div>
                    <a
                        v-if="recommendedAsset"
                        class="release-panel__cta"
                        :href="recommendedAsset.browser_download_url"
                    >
                        {{ labels.downloading }}
                    </a>
                    <a v-else class="release-panel__cta release-panel__cta--alt" :href="release.html_url">
                        {{ labels.all }}
                    </a>
                </div>

                <div class="release-panel__grid">
                    <div class="release-panel__card">
                        <h4>{{ labels.windows }}</h4>
                        <a
                            v-for="asset in manualGroups.windows"
                            :key="asset.name"
                            class="release-panel__link"
                            :href="asset.browser_download_url"
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
                            :href="asset.browser_download_url"
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
                            :href="asset.browser_download_url"
                        >
                            {{ asset.name }}
                        </a>
                    </div>
                </div>

                <p class="release-panel__foot">
                    <a :href="release.html_url || githubReleasesUrl">{{ labels.all }}</a>
                </p>
            </template>

            <template v-else>
                <div class="release-panel__status">
                    {{ labels.fallback }}
                </div>
                <p class="release-panel__foot">
                    <a :href="githubReleasesUrl">{{ labels.all }}</a>
                </p>
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
