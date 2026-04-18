import { h } from 'vue';
import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import Layout from './Layout.vue';
import AppScreenshotsShowcase from './components/AppScreenshotsShowcase.vue';
import ScreenshotPlaceholder from './components/ScreenshotPlaceholder.vue';
import HomeFeatureCards from './components/HomeFeatureCards.vue';
import HomeQuickSteps from './components/HomeQuickSteps.vue';
import ReleaseDownloadPanel from './components/ReleaseDownloadPanel.vue';
import ContactForm from './components/ContactForm.vue';
import './style.css';

export default {
    extends: DefaultTheme,
    Layout: () => h(Layout),
    enhanceApp({ app }) {
        app.component('AppScreenshotsShowcase', AppScreenshotsShowcase);
        app.component('ScreenshotPlaceholder', ScreenshotPlaceholder);
        app.component('HomeFeatureCards', HomeFeatureCards);
        app.component('HomeQuickSteps', HomeQuickSteps);
        app.component('ReleaseDownloadPanel', ReleaseDownloadPanel);
        app.component('ContactForm', ContactForm);
    },
} satisfies Theme;
