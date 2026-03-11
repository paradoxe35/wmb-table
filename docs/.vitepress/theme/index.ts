import { h } from 'vue';
import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import ScreenshotPlaceholder from './components/ScreenshotPlaceholder.vue';
import HomeFeatureCards from './components/HomeFeatureCards.vue';
import HomeQuickSteps from './components/HomeQuickSteps.vue';
import './style.css';

export default {
    extends: DefaultTheme,
    Layout: () => {
        return h(DefaultTheme.Layout);
    },
    enhanceApp({ app }) {
        app.component('ScreenshotPlaceholder', ScreenshotPlaceholder);
        app.component('HomeFeatureCards', HomeFeatureCards);
        app.component('HomeQuickSteps', HomeQuickSteps);
    },
} satisfies Theme;
