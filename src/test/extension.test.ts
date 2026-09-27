import * as assert from 'assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readStatus } from '../pushReminder';

suite('Extension Test Suite', () => {
	test('detecte les changements locaux et les commits en avance', async () => {
		const root = mkdtempSync(join(tmpdir(), 'git-push-reminder-'));
		const repositoryPath = join(root, 'repository');
		const remotePath = join(root, 'remote.git');
		mkdirSync(repositoryPath);

		try {
			execFileSync('git', ['init', '--bare', remotePath], { stdio: 'ignore' });
			execFileSync('git', ['init', '-b', 'main', repositoryPath], { stdio: 'ignore' });
			execFileSync('git', ['-C', repositoryPath, 'config', 'user.name', 'Extension Test']);
			execFileSync('git', ['-C', repositoryPath, 'config', 'user.email', 'extension-test@example.invalid']);
			writeFileSync(join(repositoryPath, 'tracked.txt'), 'initial');
			execFileSync('git', ['-C', repositoryPath, 'add', 'tracked.txt']);
			execFileSync('git', ['-C', repositoryPath, 'commit', '-m', 'Initial']);
			assert.deepStrictEqual(await readStatus(repositoryPath), { dirty: false, ahead: 1, hasUpstream: false });
			execFileSync('git', ['-C', repositoryPath, 'remote', 'add', 'origin', remotePath]);
			execFileSync('git', ['-C', repositoryPath, 'push', '--set-upstream', 'origin', 'main'], { stdio: 'ignore' });

			writeFileSync(join(repositoryPath, 'untracked.txt'), 'new');
			assert.deepStrictEqual(await readStatus(repositoryPath), { dirty: true, ahead: 0, hasUpstream: true });

			execFileSync('git', ['-C', repositoryPath, 'add', 'untracked.txt']);
			execFileSync('git', ['-C', repositoryPath, 'commit', '-m', 'Add file']);
			assert.deepStrictEqual(await readStatus(repositoryPath), { dirty: false, ahead: 1, hasUpstream: true });
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
});
