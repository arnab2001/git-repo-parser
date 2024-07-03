#!/usr/bin/env node

import { scrapeRepositoryToPlainText } from "./scraper";
import * as fs from 'fs';

async function main() {
    const repoUrl = process.argv[2]; // Get the repository URL from command line arguments

    if (!repoUrl) {
        console.error('Please provide a GitHub repository URL.');
        process.exit(1);
    }

    // Scrape the repository and get the result
    const result = await scrapeRepositoryToPlainText(repoUrl);

    // Write the JSON to a file
    fs.writeFileSync('files.txt', result);
    console.log('File list has been saved to files.text');
}

main().catch(err => console.error(err));