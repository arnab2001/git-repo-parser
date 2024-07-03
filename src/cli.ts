#!/usr/bin/env node

import { scrapeRepository } from './index';
import * as fs from 'fs';

async function main() {
    const repoUrl = process.argv[2]; // Get the repository URL from command line arguments

    if (!repoUrl) {
        console.error('Please provide a GitHub repository URL.');
        process.exit(1);
    }

    // Scrape the repository and get the result
    const result = await scrapeRepository(repoUrl);
    const jsonResult = JSON.stringify(result, null, 2);

    // Write the JSON to a file
    fs.writeFileSync('files.json', jsonResult);
    console.log('File list has been saved to files.json');
}

main().catch(err => console.error(err));
