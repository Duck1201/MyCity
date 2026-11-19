import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

const modules = ['identity', 'reports', 'notifications', 'alerts'];

export default tseslint.config(
    {
        ignores: ['**/node_modules/**', '**/dist/**', '**/src/generated/**', '**/.expo/**', '**/coverage/**'],
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    { languageOptions: { globals: { ...globals.node, ...globals.browser } } },
    {
        files: ['**/*.cjs'],
        rules: { '@typescript-eslint/no-require-imports': 'off' },
    },
    ...modules.map((name) => ({
        files: [`apps/api/src/modules/${name}/**/*.ts`],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: modules
                        .filter((other) => other !== name)
                        .map((other) => ({
                            group: [`**/${other}/**`, `!**/${other}/index.js`],
                            message: 'Importe somente a interface pública index.js de outro módulo.',
                        })),
                },
            ],
        },
    })),
    {
        files: ['apps/web/src/**/*.{ts,tsx}', 'apps/mobile/src/**/*.{ts,tsx}', 'packages/contracts/src/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: ['@prisma/*', '@mycity/api', '**/api/**', '**/generated/prisma/**', 'node:*'],
                            message: 'Clientes e contratos não importam infraestrutura do servidor.',
                        },
                    ],
                },
            ],
        },
    },
);
