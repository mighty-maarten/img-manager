import './styles/index.scss';
import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import router from './router';
import { i18nPlugin } from './plugins/i18n';
import { primevuePlugin } from './plugins/primevue';

const app = createApp(App);

app.use(i18nPlugin);
app.use(primevuePlugin);

app.use(createPinia());
app.use(router);

app.mount('#app');
