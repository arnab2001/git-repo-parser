import * as fs from 'fs';
import * as path from 'path';
import simpleGit from 'simple-git';

interface FileData {
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

function scrapeDirectory(dir: string, ignorePatterns: string[] = []): FileData[] {
    const files = fs.readdirSync(dir);
    return files.filter(file => {
        const filePath = path.join(dir, file);
        return !ignorePatterns.some(pattern => filePath.includes(pattern));
    }).map(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            return {
                name: file,
                path: filePath,
                type: 'directory',
                children: scrapeDirectory(filePath, ignorePatterns)
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
    });
}

export async function scrapeRepository(repoUrl: string): Promise<FileData[]> {
    const repoName = repoUrl.split('/').pop()?.replace('.git', '');
    if (!repoName) {
        throw new Error('Invalid repository URL');
    }
    const clonePath = `./${repoName}`; // Directory where the repository will be cloned

    // Clone the repository
    await cloneRepository(repoUrl, clonePath);

    // Scrape the cloned repository directory
    const ignorePatterns = ['.git'];
    const result = scrapeDirectory(clonePath, ignorePatterns);

    // Clean up the cloned repository
    fs.rmdirSync(clonePath, { recursive: true });
    console.log('Cloned repository directory removed');

    return result;
}
