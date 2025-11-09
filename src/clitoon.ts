#!/usr/bin/env node

import { scrapeRepositoryToToonWithTokenCount } from './scraper';
import { promises as fs } from 'fs';

async function main() {
    const args = process.argv.slice(2);

    let repoUrl: string | undefined;
    const flags = new Set<string>();

    for (const arg of args) {
        if (arg.startsWith('-')) {
            flags.add(arg);
        } else if (!repoUrl) {
            repoUrl = arg;
        } else {
            console.warn(`Ignoring unexpected argument: ${arg}`);
        }
    }

    if (!repoUrl) {
        console.error('Please provide a GitHub repository URL.');
        process.exit(1);
    }

    const showTokenCount =
        flags.has('--tokens') ||
        flags.has('--token-count') ||
        flags.has('--token') ||
        flags.has('-t');

    const { toon, tokenCount } = await scrapeRepositoryToToonWithTokenCount(repoUrl);
    await fs.writeFile('files.toon', `${toon}\n`, { encoding: 'utf-8' });
    console.log('File list has been saved to files.toon');

    if (showTokenCount) {
        console.log(`Token count (cl100k_base): ${tokenCount}`);
    }
}

main().catch(err => {
    console.error(err);
    process.exitCode = 1;
});

