<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useData } from 'vitepress';

const props = defineProps<{
    title: string;
    lead?: string;
    lightLabel: string;
    darkLabel: string;
    lightToggle: string;
    darkToggle: string;
}>();

const { isDark } = useData();
const selectedMode = ref<'light' | 'dark'>('light');

watch(
    isDark,
    (value) => {
        selectedMode.value = value ? 'dark' : 'light';
    },
    { immediate: true },
);

const screenshotSrc = computed(() =>
    selectedMode.value === 'dark' ? '/screenshot-dark.png' : '/screenshot.png',
);

const screenshotAlt = computed(() =>
    selectedMode.value === 'dark' ? props.darkLabel : props.lightLabel,
);

const selectMode = (mode: 'light' | 'dark') => {
    selectedMode.value = mode;
};
</script>

<template>
    <section class="app-shots">
        <div class="home-section-head">
            <h2>{{ title }}</h2>
            <p v-if="lead">{{ lead }}</p>
        </div>

        <div class="app-shots__toolbar" role="tablist" :aria-label="title">
            <button
                type="button"
                class="app-shots__toggle"
                :class="{ 'app-shots__toggle--active': selectedMode === 'light' }"
                :aria-pressed="selectedMode === 'light'"
                @click="selectMode('light')"
            >
                {{ lightToggle }}
            </button>
            <button
                type="button"
                class="app-shots__toggle"
                :class="{ 'app-shots__toggle--active': selectedMode === 'dark' }"
                :aria-pressed="selectedMode === 'dark'"
                @click="selectMode('dark')"
            >
                {{ darkToggle }}
            </button>
        </div>

        <figure class="app-shots__card">
            <div class="app-shots__frame">
                <img class="app-shots__image" :src="screenshotSrc" :alt="screenshotAlt" loading="lazy" />
            </div>
        </figure>
    </section>
</template>
