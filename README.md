
# git-repo-parser

A powerful tool to scrape all files from a GitHub repository and convert them into JSON or plain text format.

## Installation

Install the package globally using npm:

```bash
npm install -g git-repo-parser
```

Or add it to your project as a dependency:

```bash
npm install git-repo-parser
```

## Usage

### Command Line Interface (CLI)

This package provides two CLI commands:

1. `git-repo-to-json`: Scrapes a GitHub repository and saves the result as a JSON file.
2. `git-repo-to-text`: Scrapes a GitHub repository and saves the result as a plain text file.

#### Example usage:

```bash
git-repo-to-json https://github.com/username/repo-name.git
git-repo-to-text https://github.com/username/repo-name.git
```

The scraped data will be saved as `files.json` or `files.txt` in your current directory.

### Programmatic Usage

You can also use the package in your Node.js projects:

```javascript
import { scrapeRepositoryToJson, scrapeRepositoryToPlainText } from 'git-repo-parser';

// To get JSON output
const jsonResult = await scrapeRepositoryToJson('https://github.com/username/repo-name.git');

// To get plain text output
const textResult = await scrapeRepositoryToPlainText('https://github.com/username/repo-name.git');
```

## API

### `scrapeRepositoryToJson(repoUrl: string): Promise<FileData[]>`

Scrapes the given GitHub repository and returns a promise that resolves to an array of `FileData` objects.

### `scrapeRepositoryToPlainText(repoUrl: string): Promise<string>`

Scrapes the given GitHub repository and returns a promise that resolves to a string containing the repository contents in a structured plain text format.

## FileData Interface

The `FileData` interface represents the structure of files and directories in the JSON output:

```typescript
interface FileData {
    name: string;
    path: string;
    type: 'file' | 'directory';
    children?: FileData[];
    content?: string;
}
```

## Features

- Clones the repository locally (temporary)
- Ignores binary files and common non-source files
- Supports nested directory structures
- Provides both JSON and plain text output formats
- Cleans up cloned repository after scraping

## Ignored Files

The following file types and patterns are ignored during scraping:

- package-lock.json
- Binary files (pdf, png, jpg, jpeg, gif, ico, svg, woff, woff2, eot, ttf, otf)
- Media files (mp4, avi, webm, mov, mp3, wav, flac, ogg, webp)
- Debug and error logs (npm-debug, yarn-debug, yarn-error)
- Configuration files (tsconfig, jest.config)
- The `.git` directory

## License

This project is licensed under the MIT License.

## Author

arnab2001

## Contributing

Contributions, issues, and feature requests are welcome. Feel free to check [issues page] if you want to contribute.
Open Source Community
Conduct

We are committed to fostering a welcoming and inclusive open-source community. We expect all contributors to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md) to create a respectful and collaborative environment.
## Show your support

Give a ⭐️ if this project helped you!
```
