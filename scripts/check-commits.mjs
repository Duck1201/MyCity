import { execFileSync } from 'node:child_process';
import { isConventionalCommit } from './conventional-commits.mjs';

const head = process.env.COMMIT_HEAD ?? 'HEAD';
const base = process.env.COMMIT_BASE;
if (!/^(HEAD|[a-f0-9]{40})$/.test(head) || (base && !/^[a-f0-9]{40}$/.test(base))) throw new Error('Revisão Git inválida.');
const range = base && !/^0+$/.test(base) ? `${base}..${head}` : head;
const subjects = execFileSync('git', ['log', '--format=%s', range], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
if (process.env.PR_TITLE) subjects.push(process.env.PR_TITLE);
const invalid = subjects.filter((subject) => !isConventionalCommit(subject));
if (invalid.length) {
    console.error('Use Conventional Commits nos commits e no título do PR:');
    for (const subject of invalid) console.error(JSON.stringify(subject));
    process.exit(1);
}
console.info(`${subjects.length} títulos convencionais verificados.`);
