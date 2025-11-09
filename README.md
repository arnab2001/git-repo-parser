
# git-repo-parser

A powerful tool to scrape all files from a GitHub repository and convert them into JSON, Token-Oriented Object Notation (TOON), or RepoScript (an LLM-first transcript format).

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

This package provides three CLI commands:

1. `git-repo-to-json`: Scrapes a GitHub repository and saves the result as a JSON file.
2. `git-repo-to-toon`: Scrapes a GitHub repository and saves the result as a TOON file.
3. `git-repo-to-text`: Scrapes a GitHub repository and saves the result as a RepoScript transcript (formerly the “plain text” output).

#### Example usage:

```bash
# JSON and TOON exports (existing behaviour)
git-repo-to-json https://github.com/username/repo-name.git
git-repo-to-toon https://github.com/username/repo-name.git

# RepoScript transcript without metadata (legacy plain-text behaviour)
git-repo-to-text https://github.com/username/repo-name.git --format=transcript

# RepoScript transcript with metadata lines and token count
git-repo-to-text https://github.com/username/repo-name.git --format=transcript --meta --tokens

# Alternate syntaxes
git-repo-to-text https://github.com/username/repo-name.git --format=json
git-repo-to-text https://github.com/username/repo-name.git --format=toon
```

The scraped data will be saved as `files.json`, `files.toon`, or `files.txt` in your current directory. When `--tokens` (or `--token`, `--token-count`, `-t`) is supplied, the CLI also prints the token count using the [CL100K vocabulary](https://github.com/openai/openai-openapi/blob/master/specification.md) for **any** export format. Use `--meta` / `--no-meta` to toggle RepoScript metadata lines (default is no metadata).

### Benchmark Suite

Run the bundled benchmark to evaluate scrape runtime and token usage across multiple public repositories:

```bash
npm run build
npm run benchmark
```

Results are saved under `benchmark/`:

- `benchmark/results.json` – machine-readable summary (durations, token counts, output sizes)
- `benchmark/results.md` – markdown report per repository/format
- `benchmark/*.preview.txt` – first 100 lines of each export for spot-checking

### Programmatic Usage

You can also use the package in your Node.js projects:

```javascript
import {
  scrapeRepositoryToJson,
  scrapeRepositoryToToon,
  scrapeRepositoryToTranscript,
  scrapeRepositoryToJsonWithTokenCount,
  scrapeRepositoryToToonWithTokenCount,
  scrapeRepositoryToPlainTextWithTokenCount,
  type TranscriptFormatOptions,
  countTokens,
} from 'git-repo-parser';

const repoUrl = 'https://github.com/username/repo-name.git';

// JSON output
const jsonResult = await scrapeRepositoryToJson(repoUrl);

// TOON output
const toonResult = await scrapeRepositoryToToon(repoUrl);

// RepoScript transcript (no metadata; equivalent to legacy plain text)
const transcript = await scrapeRepositoryToTranscript(repoUrl);

// RepoScript with metadata lines
const transcriptOptions: TranscriptFormatOptions = { includeMeta: true };
const richTranscript = await scrapeRepositoryToTranscript(repoUrl, transcriptOptions);

// Token-aware helpers
const { json, tokenCount: jsonTokens } = await scrapeRepositoryToJsonWithTokenCount(repoUrl);
const { toon, tokenCount: toonTokens } = await scrapeRepositoryToToonWithTokenCount(repoUrl);
const { text, tokenCount: transcriptTokens } = await scrapeRepositoryToPlainTextWithTokenCount(
  repoUrl,
  undefined,
  transcriptOptions
);

// Standalone token counting helper (uses gpt-tokenizer + cl100k_base)
const tokens = countTokens(toon);
```

## API

### `scrapeRepositoryToJson(repoUrl: string): Promise<FileData[]>`

Scrapes the given GitHub repository and returns a promise that resolves to an array of `FileData` objects.

### `scrapeRepositoryToJsonWithTokenCount(repoUrl: string, indent = 2, tokenOptions?: TokenCountOptions): Promise<{ files: FileData[]; json: string; tokenCount: number }>`

Scrapes the repository, returns the raw `FileData[]`, a pretty-printed JSON string, and the corresponding CL100K token consumption.

### `scrapeRepositoryToToon(repoUrl: string, options?: EncodeOptions): Promise<string>`

Scrapes the given GitHub repository and returns a promise that resolves to a TOON-formatted string. You can pass [`EncodeOptions`](https://github.com/toon-format/toon#encoding) directly to customise indentation, delimiter, or length markers.

### `scrapeRepositoryToToonWithTokenCount(repoUrl: string, encodeOptions?: EncodeOptions, tokenOptions?: TokenCountOptions): Promise<{ toon: string; tokenCount: number }>`

Generates the TOON-formatted output and returns both the encoded string and its token count as measured by [gpt-tokenizer](https://www.npmjs.com/package/gpt-tokenizer) using the default CL100K vocabulary.

### `scrapeRepositoryToTranscript(repoUrl: string, options?: TranscriptFormatOptions): Promise<string>`

Scrapes the given GitHub repository and returns a RepoScript v1 transcript string. `TranscriptFormatOptions` currently supports `{ includeMeta?: boolean }` (default: `false`). The legacy `scrapeRepositoryToPlainText` export delegates to this helper with metadata disabled.

### `scrapeRepositoryToPlainTextWithTokenCount(repoUrl: string, tokenOptions?: TokenCountOptions, transcriptOptions?: TranscriptFormatOptions): Promise<{ text: string; tokenCount: number }>`

Scrapes the repository to RepoScript while reporting the token footprint of the generated transcript. Supply `transcriptOptions` to mirror CLI behaviour (e.g. `{ includeMeta: true }`).

## RepoScript v1 Format

RepoScript is a deterministic, LLM-friendly transcript of a repository (formerly the “plain text” output).

- **Deterministic ordering**  
  - Directories are emitted in lexical order of their full POSIX paths.  
  - Within a directory, files are listed in lexical order by filename.
- **Marker grammar**  
  - Markers always begin at column 0 and follow `[TAG] <path>` (single space).  
  - Tags in use: `[DIR_START]`, `[DIR_END]`, `[FILE_START]`, `[FILE_END]`.  
  - Paths are POSIX (e.g. `src/index.ts`) and never contain newlines.
- **Optional metadata**  
  - When `includeMeta` is enabled, files receive lines like `meta: lang=ts size=1234`.  
  - Metadata lines appear immediately after `[FILE_START] <path>` and before file contents.
- **Reserved tags**  
  - `[COMMENT]`, `[CHUNK]`, and `[META]` are reserved for future use and MUST NOT appear unless escaped or emitted intentionally once semantics are defined.

### Sample Transcript

```text
REPOSCRIPT version=1
repo: https://github.com/user/project
commit: abc123

[FILE_START] src/index.ts
meta: lang=ts size=123
import { foo } from './foo';

[FILE_END] src/index.ts
```

> Note: The current CLI/API emit the `[..._START]` / `[..._END]` markers (with optional metadata). The header lines shown above are illustrative and may be added via tooling or future options.

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
Also Check [Contribution Guide](CONTRIBUTION.md)
Open Source Community
Conduct

We are committed to fostering a welcoming and inclusive open-source community. We expect all contributors to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md) to create a respectful and collaborative environment.
## Show your support

Give a ⭐️ if this project helped you!
```
