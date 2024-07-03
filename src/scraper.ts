import * as fs from 'fs';
import * as path from 'path';
import simpleGit from 'simple-git';

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

function scrapeDirectoryToJson(dir: string, ignorePatterns: string[] = []): FileData[] {
    const files = fs.readdirSync(dir);
    return files.filter(file => {
        const filePath = path.join(dir, file);
        return (
            !ignorePatterns.some(pattern => filePath.includes(pattern)) &&
            !shouldIgnoreFile(file)
        );
    }).map(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            // Ignore the .git directory
            if (file === '.git') {
                return null;
            }
            return {
                name: file,
                path: filePath,
                type: 'directory',
                children: scrapeDirectoryToJson(filePath, ignorePatterns)
            };
        } else {
            const content = fs.readFileSync(filePath, 'utf-8');
            return {
                name: file,
                path: filePath,
                type: 'file',
                content: content
            };
        }
    }).filter(item => item !== null) as FileData[];
}

function scrapeDirectoryToPlainText(dir: string, ignorePatterns: string[] = [], prefix: string = ''): string {
    let result = '';

    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);

        if (ignorePatterns.some(pattern => filePath.includes(pattern)) || shouldIgnoreFile(file)) {
            return;
        }

        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            // Ignore the .git directory
            if (file === '.git') {
                return;
            }
            // Mark the start of a directory
            result += `[DIR_START]${path.join(prefix, file)}\n`;
            result += scrapeDirectoryToPlainText(filePath, ignorePatterns, path.join(prefix, file));
            // Mark the end of a directory
            result += `[DIR_END]${path.join(prefix, file)}\n\n`;
        } else {
            // Mark the start of a file
            result += `[FILE_START]${path.join(prefix, file)}\n`;
            const content = fs.readFileSync(filePath, 'utf-8');
            result += content;
            // Mark the end of a file
            result += `\n[FILE_END]${path.join(prefix, file)}\n\n`;
        }
    });

    return result;
}

export async function scrapeRepositoryToJson(repoUrl: string): Promise<FileData[]> {
    const repoName = repoUrl.split('/').pop()?.replace('.git', '');
    if (!repoName) {
        throw new Error('Invalid repository URL');
    }
    const clonePath = `./${repoName}`; // Directory where the repository will be cloned

    // Clone the repository
    await cloneRepository(repoUrl, clonePath);

    // Scrape the cloned repository directory
    const ignorePatterns = ['.git'];
    const result = scrapeDirectoryToJson(clonePath, ignorePatterns);

    // Clean up the cloned repository
    fs.rmdirSync(clonePath, { recursive: true });
    console.log('Cloned repository directory removed');

    return result;
}

export async function scrapeRepositoryToPlainText(repoUrl: string): Promise<string> {
    const repoName = repoUrl.split('/').pop()?.replace('.git', '');
    if (!repoName) {
        throw new Error('Invalid repository URL');
    }
    const clonePath = `./${repoName}`; // Directory where the repository will be cloned

    // Clone the repository
    await cloneRepository(repoUrl, clonePath);

    // Scrape the cloned repository directory
    const ignorePatterns = ['.git'];
    const result = scrapeDirectoryToPlainText(clonePath, ignorePatterns);

    // Clean up the cloned repository
    fs.rmdirSync(clonePath, { recursive: true });
    console.log('Cloned repository directory removed');

    return result;
}
