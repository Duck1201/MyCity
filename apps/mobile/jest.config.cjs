module.exports = {
    preset: 'jest-expo',
    setupFilesAfterEnv: ['<rootDir>/tests/setup.cjs'],
    testMatch: ['<rootDir>/tests/**/*.test.tsx'],
};
