import path from 'path';
import fs from 'fs';
const fsPromises = fs.promises;
import gitP from 'simple-git/promise';

import cfg from './config/git.json';
import walk from 'walk-promise';

(async () => {
    const workingDir = path.join(__dirname, '_repository');

    /* Check if working dir exists */
    await fs.stat(workingDir, error => {
        // Create if it doesnt exist
        if (error) {
            fs.mkdir(workingDir, { recursive: true }, err => {
                if (err) throw err;
            });
        }
    });

    const git = gitP(workingDir);

    /* Check if local isRepo */
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
        console.log('Initializing repository');
        await git.init();

        console.log(`Adding remote '${cfg.repository}'`);
        await git.addRemote('origin', cfg.repository);

        console.log('Fetching...');
        git.fetch();
    }

    /* Pulls newest changes */
    console.log('Pulling changes...');
    await git.pull('origin', 'master');

    /* Copy merge files */
    console.log('Copy merge files...');
    for (let file of await walk(path.join(__dirname, '_merge'))) {
        const fPath = file.root.replace(path.join(__dirname, '_merge'), '');
        await fsPromises.mkdir(path.join(__dirname, '_repository', fPath), { recursive: true });
        await fsPromises.copyFile(
            path.join(__dirname, '_merge', fPath, file.name),
            path.join(__dirname, '_repository', fPath, file.name)
        );
        console.log(`Copy file '${file.name}'`);
    }

    /* Create process */
    const { spawn } = require('child_process');
    await new Promise(resolve => {
        const ls = spawn('docker-compose', ['up', '--build', '-d'], {
            cwd: path.join(__dirname, '_repository', 'vue'),
        });

        ls.stdout.on('data', data => {
            console.log(`${data}`);
        });

        ls.stderr.on('data', data => {
            console.error(`Error: ${data}`);
        });

        ls.on('close', resolve);
    });
})();
