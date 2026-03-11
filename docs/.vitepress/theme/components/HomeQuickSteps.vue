<script setup lang="ts">
defineProps<{
    title: string;
    items: Array<{
        title: string;
        text: string;
    }>;
}>();
</script>

<template>
    <section class="home-quick-steps">
        <div class="home-section-head">
            <h2>{{ title }}</h2>
        </div>
        <div class="home-quick-steps__grid">
            <article v-for="(item, index) in items" :key="item.title" class="home-step-card">
                <div class="home-step-card__number">{{ index + 1 }}</div>
                <h3>{{ item.title }}</h3>
                <p>{{ item.text }}</p>
            </article>
        </div>
    </section>
</template>
