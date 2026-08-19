import { defineConfig } from 'astro/config';
import helpbox from '@ookam/helpbox';
import config from './helpbox.config.ts';

export default defineConfig({
  integrations: [helpbox({ config })],
});
