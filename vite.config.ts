import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({ plugins: [react(), {
  name: 'field-native-local-shell',
  transformIndexHtml(html) {
    return process.env.VITE_FIELD_PLATFORM === 'ios' ? html.replace(/<script[^>]+src="https:\/\/telegram.org\/js\/telegram-web-app.js[^>]*><\/script>/, '') : html;
  },
}] });
