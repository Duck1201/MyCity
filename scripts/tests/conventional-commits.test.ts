import { describe, expect, it } from 'vitest';
import { isConventionalCommit } from '../conventional-commits.mjs';

describe('Conventional Commits', () => {
    it.each(['feat(reports): add report creation', 'fix: reject expired sessions', 'chore!: change workspace layout', 'ci(github): publish images', 'docs: clarify scope'])('aceita %s', (subject) => {
        expect(isConventionalCommit(subject)).toBe(true);
    });
    it.each(['update files', 'feature: add login', 'feat:add login', 'fix: ', 'docs: first\nsecond'])('rejeita %s', (subject) => {
        expect(isConventionalCommit(subject)).toBe(false);
    });
});
