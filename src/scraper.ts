import { promises as fs } from 'fs';
import type { Dirent } from 'fs';
import * as path from 'path';
import * as os from 'os';
import simpleGit from 'simple-git';
import { encode, type EncodeOptions } from '@toon-format/toon';
import { countTokens, type TokenCountOptions } from './tokenCounter';

export interface FileData {
    name: string;
    path: string;
    type: 'file' | 'directory';
    children?: FileData[];
    content?: string;
}

async function cloneRepository(repoUrl: string, clonePath: string) {
    const git = simpleGit();
    await git.clone(repoUrl, clonePath);
    console.log(`Repository cloned to ${clonePath}`);
}

const MAX_CONCURRENCY = 10;
const IGNORED_SEGMENTS = new Set<string>(['.git']);

const EXTENSION_LANG_MAP: Record<string, string> = {
    '.ts': 'ts',
    '.tsx': 'tsx',
    '.js': 'js',
    '.jsx': 'jsx',
    '.mjs': 'js',
    '.cjs': 'js',
    '.json': 'json',
    '.md': 'md',
    '.py': 'py',
    '.rb': 'rb',
    '.go': 'go',
    '.rs': 'rs',
    '.java': 'java',
    '.kt': 'kt',
    '.kts': 'kt',
    '.swift': 'swift',
    '.c': 'c',
    '.h': 'c',
    '.cpp': 'cpp',
    '.hpp': 'cpp',
    '.cc': 'cpp',
    '.hh': 'cpp',
    '.cs': 'cs',
    '.php': 'php',
    '.sh': 'sh',
    '.bash': 'sh',
    '.zsh': 'sh',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.toml': 'toml',
    '.ini': 'ini',
    '.cfg': 'ini',
    '.txt': 'txt',
    '.css': 'css',
    '.scss': 'scss',
    '.sass': 'sass',
    '.less': 'less',
    '.vue': 'vue',
    '.svelte': 'svelte'
};

export interface TranscriptFormatOptions {
    includeMeta?: boolean;
}

function sanitiseRepoLabel(repoUrl: string): string {
    let candidate = repoUrl.trim();

    try {
        const parsed = new URL(repoUrl);
        candidate = parsed.pathname.split('/').pop() ?? '';
    } catch {
        const segments = candidate.split('/');
        candidate = segments[segments.length - 1] ?? '';
    }

    candidate = candidate.replace(/\.git$/i, '');
    const sanitised = candidate.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
    const truncated = sanitised.slice(0, 64);
    return truncated || 'repository';
}

async function prepareCloneWorkspace(repoUrl: string) {
    const repoLabel = sanitiseRepoLabel(repoUrl);
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'git-repo-parser-'));
    const clonePath = path.join(tempRoot, repoLabel);

    async function cleanup() {
        try {
            await fs.rm(tempRoot, { recursive: true, force: true });
        } catch (error) {
            console.warn(`Failed to clean temporary directory ${tempRoot}:`, error);
        }
    }

    return { clonePath, cleanup };
}

function toPosixPath(filePath: string): string {
    return filePath.split(path.sep).join('/');
}

function shouldIgnorePath(relativePath: string, ignoreSegments: Set<string>): boolean {
    const segments = relativePath.split(path.sep).filter(Boolean);
    return segments.some(segment => ignoreSegments.has(segment));
}

async function mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let nextIndex = 0;

    async function worker() {
        while (true) {
            const currentIndex = nextIndex++;
            if (currentIndex >= items.length) {
                break;
            }
            results[currentIndex] = await mapper(items[currentIndex], currentIndex);
        }
    }

    const workerCount = Math.min(limit, items.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
}

function shouldIgnoreFile(fileName: string): boolean {
    const lowerCaseFileName = fileName.toLowerCase();
    return (
        lowerCaseFileName === 'package-lock.json' ||
        lowerCaseFileName.endsWith('.pdf') ||
        lowerCaseFileName.endsWith('.png') ||
        lowerCaseFileName.endsWith('.jpg') ||
        lowerCaseFileName.endsWith('.jpeg') ||
        lowerCaseFileName.endsWith('.gif') ||
        lowerCaseFileName.endsWith('.ico') ||
        lowerCaseFileName.endsWith('.svg') ||
        lowerCaseFileName.endsWith('.woff') ||
        lowerCaseFileName.endsWith('.woff2') ||
        lowerCaseFileName.endsWith('.eot') ||
        lowerCaseFileName.endsWith('.ttf') ||
        lowerCaseFileName.endsWith('.otf') ||
        lowerCaseFileName.endsWith('.mp4') ||
        lowerCaseFileName.endsWith('.avi') ||
        lowerCaseFileName.endsWith('.webm') ||
        lowerCaseFileName.endsWith('.mov') ||
        lowerCaseFileName.endsWith('.mp3') ||
        lowerCaseFileName.endsWith('.wav') ||
        lowerCaseFileName.endsWith('.flac') ||
        lowerCaseFileName.endsWith('.ogg') ||
        lowerCaseFileName.endsWith('.webp') ||
        lowerCaseFileName.startsWith('package-lock') ||
        lowerCaseFileName.startsWith('yarn-lock') ||
        lowerCaseFileName.startsWith('npm-debug') ||
        lowerCaseFileName.startsWith('yarn-debug') ||
        lowerCaseFileName.startsWith('yarn-error') ||
        lowerCaseFileName.startsWith('tsconfig') ||
        lowerCaseFileName.startsWith('jest.config') 

        // Add more extensions as needed
    );
}

async function scrapeDirectoryToJson(
    dir: string,
    baseDir: string,
    ignoreSegments: Set<string>
): Promise<FileData[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    const processed = await mapWithConcurrency(entries, MAX_CONCURRENCY, async (entry) => {
        const entryPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, entryPath);

        if (!relativePath) {
            return null;
        }
        if (shouldIgnorePath(relativePath, ignoreSegments) || shouldIgnoreFile(entry.name)) {
            return null;
        }

        try {
            if (entry.isDirectory()) {
                const children = await scrapeDirectoryToJson(entryPath, baseDir, ignoreSegments);
                return {
                    name: entry.name,
                    path: toPosixPath(relativePath),
                    type: 'directory' as const,
                    children
                };
            }

            if (entry.isFile()) {
                const content = await fs.readFile(entryPath, { encoding: 'utf-8' });
                return {
                    name: entry.name,
                    path: toPosixPath(relativePath),
                    type: 'file' as const,
                    content
                };
            }
        } catch (error) {
            console.warn(`Skipping ${entryPath} due to error:`, error);
        }

        return null;
    });

    const filtered = processed.filter((item): item is NonNullable<typeof item> => item !== null);
    return filtered as FileData[];
}

function detectLanguage(fileName: string): string | undefined {
    const ext = path.extname(fileName).toLowerCase();
    return EXTENSION_LANG_MAP[ext];
}

function sortDirEntries(entries: Dirent[]): { directories: Dirent[]; files: Dirent[] } {
    const directories = entries.filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
    const files = entries.filter(entry => entry.isFile()).sort((a, b) => a.name.localeCompare(b.name));
    return { directories, files };
}

function createMetadataLine(fileName: string, content: string): string {
    const size = Buffer.byteLength(content, 'utf-8');
    const metadata: string[] = [`size=${size}`];
    const lang = detectLanguage(fileName);
    if (lang) {
        metadata.unshift(`lang=${lang}`);
    }
    return `meta: ${metadata.join(' ')}`;
}

async function generateTranscript(
    dir: string,
    baseDir: string,
    ignoreSegments: Set<string>,
    options: TranscriptFormatOptions,
    prefix = ''
): Promise<string> {
    let result = '';

    const entries = await fs.readdir(dir, { withFileTypes: true });

    const { directories, files } = sortDirEntries(entries);

    for (const entry of directories) {
        const filePath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, filePath);

        if (!relativePath) {
            continue;
        }
        if (shouldIgnorePath(relativePath, ignoreSegments) || shouldIgnoreFile(entry.name)) {
            continue;
        }

        const displayPath = toPosixPath(path.join(prefix, entry.name));

        try {
            result += `[DIR_START] ${displayPath}\n`;
            result += await generateTranscript(
                filePath,
                baseDir,
                ignoreSegments,
                options,
                path.join(prefix, entry.name)
            );
            result += `[DIR_END] ${displayPath}\n\n`;
        } catch (error) {
            console.warn(`Skipping ${filePath} due to error:`, error);
        }
    }

    for (const entry of files) {
        const filePath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, filePath);

        if (!relativePath) {
            continue;
        }
        if (shouldIgnorePath(relativePath, ignoreSegments) || shouldIgnoreFile(entry.name)) {
            continue;
        }

        const displayPath = toPosixPath(path.join(prefix, entry.name));

        try {
            const content = await fs.readFile(filePath, { encoding: 'utf-8' });
            result += `[FILE_START] ${displayPath}\n`;

            if (options.includeMeta) {
                result += `${createMetadataLine(entry.name, content)}\n`;
            }

            result += content;
            if (!content.endsWith('\n')) {
                result += '\n';
            }
            result += `[FILE_END] ${displayPath}\n\n`;
        } catch (error) {
            console.warn(`Skipping ${filePath} due to error:`, error);
        }
    }

    return result;
}

export async function scrapeRepositoryToJson(repoUrl: string): Promise<FileData[]> {
    const { clonePath, cleanup } = await prepareCloneWorkspace(repoUrl);

    try {
        await cloneRepository(repoUrl, clonePath);
        return await scrapeDirectoryToJson(clonePath, clonePath, IGNORED_SEGMENTS);
    } finally {
        await cleanup();
    }
}

export async function scrapeRepositoryToPlainText(repoUrl: string): Promise<string> {
    return scrapeRepositoryToTranscript(repoUrl);
}

export async function scrapeRepositoryToTranscript(
    repoUrl: string,
    options: TranscriptFormatOptions = {}
): Promise<string> {
    const { clonePath, cleanup } = await prepareCloneWorkspace(repoUrl);

    try {
        await cloneRepository(repoUrl, clonePath);
        return await generateTranscript(clonePath, clonePath, IGNORED_SEGMENTS, {
            includeMeta: options.includeMeta ?? false
        });
    } finally {
        await cleanup();
    }
}

export async function scrapeRepositoryToToon(
    repoUrl: string,
    options?: EncodeOptions
): Promise<string> {
    const { toon } = await scrapeRepositoryToToonWithTokenCount(repoUrl, options);
    return toon;
}

export interface ToonScrapeResult {
    toon: string;
    tokenCount: number;
}

export async function scrapeRepositoryToToonWithTokenCount(
    repoUrl: string,
    encodeOptions?: EncodeOptions,
    tokenOptions?: TokenCountOptions
): Promise<ToonScrapeResult> {
    const files = await scrapeRepositoryToJson(repoUrl);
    const toon = encode({ files }, encodeOptions);
    return {
        toon,
        tokenCount: countTokens(toon, tokenOptions)
    };
}

export interface JsonScrapeResult {
    files: FileData[];
    json: string;
    tokenCount: number;
}

export async function scrapeRepositoryToJsonWithTokenCount(
    repoUrl: string,
    indent = 2,
    tokenOptions?: TokenCountOptions
): Promise<JsonScrapeResult> {
    const files = await scrapeRepositoryToJson(repoUrl);
    const json = JSON.stringify(files, null, indent);
    return {
        files,
        json,
        tokenCount: countTokens(json, tokenOptions)
    };
}

export interface TranscriptScrapeResult {
    text: string;
    tokenCount: number;
}

export type PlainTextScrapeResult = TranscriptScrapeResult;

export async function scrapeRepositoryToPlainTextWithTokenCount(
    repoUrl: string,
    tokenOptions?: TokenCountOptions,
    transcriptOptions?: TranscriptFormatOptions
): Promise<TranscriptScrapeResult> {
    const text = await scrapeRepositoryToTranscript(repoUrl, transcriptOptions);
    return {
        text,
        tokenCount: countTokens(text, tokenOptions)
    };
}
