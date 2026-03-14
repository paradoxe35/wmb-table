<script setup lang="ts">
defineProps<{
    items: Array<{
        title: string;
        text: string;
        icon: string;
    }>;
}>();
</script>

<template>
    <div class="home-feature-grid">
        <article v-for="item in items" :key="item.title" class="home-feature-card">
            <div class="home-feature-card__icon">{{ item.icon }}</div>
            <h3>{{ item.title }}</h3>
            <p>{{ item.text }}</p>
        </article>
    </div>
</template>
