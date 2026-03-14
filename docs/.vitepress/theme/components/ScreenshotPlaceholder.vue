<script setup lang="ts">
defineProps<{
    file: string;
    label: string;
    hint?: string;
}>();
</script>

<template>
    <figure class="doc-shot">
        <div class="doc-shot__frame">
            <div class="doc-shot__badge">Screenshot Placeholder</div>
            <div class="doc-shot__label">{{ label }}</div>
            <div class="doc-shot__file">{{ file }}</div>
            <p v-if="hint" class="doc-shot__hint">{{ hint }}</p>
        </div>
    </figure>
</template>
