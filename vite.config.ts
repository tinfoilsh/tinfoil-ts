import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/**/*.{test,spec}.ts'],
        coverage: {
            reporter: ['text', 'html'],
            include: ['src/**/*.ts'],
        },
    },
});
