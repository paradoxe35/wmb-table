<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import screenshotDark from '../assets/screenshot-dark.png';
import screenshotLight from '../assets/screenshot-light.png';

const props = defineProps<{
    title: string;
    lead?: string;
    lightLabel: string;
    darkLabel: string;
}>();

const isReady = ref(false);
const themeMode = ref<'light' | 'dark'>('light');
let observer: MutationObserver | null = null;

const readThemeMode = (): 'light' | 'dark' => {
    if (typeof document === 'undefined') {
        return 'light';
    }

    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
};

const syncThemeMode = () => {
    themeMode.value = readThemeMode();
};

onMounted(() => {
    syncThemeMode();
    isReady.value = true;

    observer = new MutationObserver(() => {
        syncThemeMode();
    });

    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
    });
});

onBeforeUnmount(() => {
    observer?.disconnect();
});

const screenshotSrc = computed(() =>
    themeMode.value === 'dark' ? screenshotDark : screenshotLight,
);

const screenshotAlt = computed(() =>
    themeMode.value === 'dark' ? props.darkLabel : props.lightLabel,
);
</script>

<template>
    <section class="app-shots">
        <div class="home-section-head">
            <h2>{{ title }}</h2>
            <p v-if="lead">{{ lead }}</p>
        </div>

        <figure v-if="isReady" class="app-shots__card">
            <div class="app-shots__frame">
                <img class="app-shots__image" :src="screenshotSrc" :alt="screenshotAlt" loading="lazy" />
            </div>
        </figure>
    </section>
</template>
