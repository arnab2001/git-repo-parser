#!/usr/bin/env node

import { promises as fs } from 'fs';
import {
    scrapeRepositoryToJsonWithTokenCount,
    scrapeRepositoryToToonWithTokenCount,
    scrapeRepositoryToPlainTextWithTokenCount,
    type TranscriptFormatOptions
} from './scraper';

type OutputFormat = 'json' | 'toon' | 'transcript';

interface ParsedOptions {
    repoUrl?: string;
    format: OutputFormat;
    includeMeta: boolean;
    showTokenCount: boolean;
}

function parseArgs(args: string[]): ParsedOptions {
    let repoUrl: string | undefined;
    let format: OutputFormat = 'transcript';
    let includeMeta = false;
    let showTokenCount = false;

    for (let i = 0; i < args.length; i += 1) {
        const arg = args[i];

        if (arg === '--format') {
            const value = args[i + 1];
            if (!value) {
                throw new Error('Expected a value after --format');
            }
            format = parseFormat(value);
            i += 1;
            continue;
        }

        if (arg.startsWith('--format=')) {
            const value = arg.split('=', 2)[1] ?? '';
            format = parseFormat(value);
            continue;
        }

        if (arg === '--meta') {
            includeMeta = true;
            continue;
        }

        if (arg === '--no-meta') {
            includeMeta = false;
            continue;
        }

        if (arg === '--tokens' || arg === '--token-count' || arg === '--token' || arg === '-t') {
            showTokenCount = true;
            continue;
        }

        if (arg.startsWith('-')) {
            console.warn(`Ignoring unrecognised flag: ${arg}`);
            continue;
        }

        if (!repoUrl) {
            repoUrl = arg;
        } else {
            console.warn(`Ignoring unexpected argument: ${arg}`);
        }
    }

    return { repoUrl, format, includeMeta, showTokenCount };
}

function parseFormat(value: string): OutputFormat {
    const normalised = value.trim().toLowerCase();
    if (normalised === 'json' || normalised === 'toon' || normalised === 'transcript') {
        return normalised;
    }
    throw new Error(`Unsupported format "${value}". Expected one of: json, toon, transcript.`);
}

async function main() {
    let options: ParsedOptions;
    try {
        options = parseArgs(process.argv.slice(2));
    } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
        return;
    }

    const { repoUrl, format, includeMeta, showTokenCount } = options;

    if (!repoUrl) {
        console.error('Please provide a GitHub repository URL.');
        process.exit(1);
        return;
    }

    switch (format) {
        case 'json':
            await handleJson(repoUrl, showTokenCount);
            break;
        case 'toon':
            await handleToon(repoUrl, showTokenCount);
            break;
        case 'transcript':
        default:
            await handleTranscript(repoUrl, includeMeta, showTokenCount);
            break;
    }
}

async function handleJson(repoUrl: string, showTokenCount: boolean) {
    const { json, tokenCount } = await scrapeRepositoryToJsonWithTokenCount(repoUrl);
    await fs.writeFile('files.json', `${json}\n`, { encoding: 'utf-8' });
    console.log('File list has been saved to files.json');
    if (showTokenCount) {
        console.log(`Token count (cl100k_base): ${tokenCount}`);
    }
}

async function handleToon(repoUrl: string, showTokenCount: boolean) {
    const { toon, tokenCount } = await scrapeRepositoryToToonWithTokenCount(repoUrl);
    await fs.writeFile('files.toon', `${toon}\n`, { encoding: 'utf-8' });
    console.log('File list has been saved to files.toon');
    if (showTokenCount) {
        console.log(`Token count (cl100k_base): ${tokenCount}`);
    }
}

async function handleTranscript(repoUrl: string, includeMeta: boolean, showTokenCount: boolean) {
    const transcriptOptions: TranscriptFormatOptions = { includeMeta };
    const { text, tokenCount } = await scrapeRepositoryToPlainTextWithTokenCount(
        repoUrl,
        undefined,
        transcriptOptions
    );

    await fs.writeFile('files.txt', text, { encoding: 'utf-8' });
    console.log('RepoScript transcript has been saved to files.txt');

    if (showTokenCount) {
        console.log(`Token count (cl100k_base): ${tokenCount}`);
    }
}

main().catch(err => {
    console.error(err);
    process.exitCode = 1;
});