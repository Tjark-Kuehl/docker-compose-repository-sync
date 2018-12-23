import path from 'path'
import { promises as fs } from 'fs'
import gitP from 'simple-git/promise'
import { spawn } from 'child_process'

import cfg from './config/daemon-config.json'
import walk from 'walk-promise'

const repoDir = path.join(__dirname, '..', '_repository')
const mergeDir = path.join(__dirname, '..', '_merge')
const dockerComposeFileDir = path.join(repoDir, cfg.dockerComposeFileDir)

let git
;(async () => {
    /* Create default directories */
    await createDir(repoDir)
    await createDir(mergeDir)

    git = gitP(repoDir)

    /* Check if the repoDir is a valid repository */
    const isRepo = await git.checkIsRepo()
    if (!isRepo) {
        await cloneRepo(cfg.repo.url)
    }

    console.log('Copy merge files...')
    await copyMergeFiles()

    await startContainers(dockerComposeFileDir)

    await loop()
})()

async function loop() {
    const {
        summary: { changes, insertions, deletions }
    } = await git.pull('origin', cfg.repo.branch)

    console.log(changes, insertions, deletions)

    if (changes || insertions || deletions) {
        await startContainers(dockerComposeFileDir)
    }

    setTimeout(loop, cfg.minPullIntervalInSec * 1000)
}

async function createDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true })
}

async function cloneRepo(repoUrl) {
    console.log('Initializing repository')
    await git.init()

    console.log(`Adding remote '${repoUrl}'`)
    await git.addRemote('origin', repoUrl)

    // console.log('Fetching...');
    // git.fetch();
}

async function copyMergeFiles() {
    for (const file of await walk(mergeDir)) {
        const fPath = file.root.replace(mergeDir, '')
        await fs.mkdir(path.join(repoDir, fPath), { recursive: true })
        await fs.copyFile(
            path.join(mergeDir, fPath, file.name),
            path.join(repoDir, fPath, file.name)
        )
        console.log(`Copy file '${file.name}'`)
    }
}

/**
 * Creates a docker-copose up process
 * @return Promise<Number>
 */
function startContainers(cwd) {
    return new Promise(resolve => {
        const ls = spawn('docker-compose', ['up', '--build', '-d'], {
            cwd
        })

        function logToConsole(message) {
            if (message && message.length) {
                console.log(String(message))
            }
        }

        ls.stdout.on('data', logToConsole)
        ls.stderr.on('data', logToConsole)
        ls.on('close', resolve)
    })
}
