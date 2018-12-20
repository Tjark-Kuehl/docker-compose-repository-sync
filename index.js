import path from 'path';
import { promises as fs } from 'fs';
import gitP from 'simple-git/promise';
import { spawn } from 'child_process';
//const { spawn } = require('child_process');

import cfg from './config/git.json';
import walk from 'walk-promise';

(async () => {
    const repoDir = path.join(__dirname, '_repository');

    /* Create default directories */
    await fs.mkdir(repoDir, { recursive: true });
    await fs.mkdir(path.join(__dirname, '_merge'), { recursive: true });

    /* Set git dir */
    const git = gitP(repoDir);

    /* Check if the repoDir is a valid repository */
    const isRepo = await git.checkIsRepo();
    console.log(isRepo);
    if (!isRepo) {
        await initGitProject(cfg.repository);
    }

    console.log('Pulling changes...');
    console.log(await git.pull('origin', 'master'));

    return;
    console.log('Copy merge files...');
    await copyMergeFiles(__dirname);

    await startContainers(path.join(repoDir, 'vue'));
})();

async function initGitProject(repoUrl) {
    console.log('Initializing repository');
    await git.init();

    console.log(`Adding remote '${repoUrl}'`);
    await git.addRemote('origin', repoUrl);

    // console.log('Fetching...');
    // git.fetch();
}

async function copyMergeFiles(baseDir) {
    for (const file of await walk(path.join(baseDir, '_merge'))) {
        const fPath = file.root.replace(path.join(baseDir, '_merge'), '');
        await fs.mkdir(path.join(baseDir, '_repository', fPath), { recursive: true });
        await fs.copyFile(
            path.join(baseDir, '_merge', fPath, file.name),
            path.join(baseDir, '_repository', fPath, file.name)
        );
        console.log(`Copy file '${file.name}'`);
    }
}

/**
 * Creates a docker-copose up process
 * @return Promise<Number>
 */
function startContainers(cwd) {
    return new Promise(resolve => {
        const ls = spawn('docker-compose', ['up', '--build', '-d'], {
            cwd,
        });

        function logToConsole(message) {
            if (message && message.length) {
                console.log(String(message));
            }
        }

        ls.stdout.on('data', logToConsole);
        ls.stderr.on('data', logToConsole);

        ls.on('close', resolve);
    });
}
