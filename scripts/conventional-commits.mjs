export function isConventionalCommit(subject) {
    return /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9][a-z0-9./_-]*\))?!?: \S[^\r\n]*$/.test(subject);
}
