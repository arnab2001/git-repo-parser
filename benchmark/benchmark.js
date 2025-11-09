#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
const { performance } = require('perf_hooks');
const {
  scrapeRepositoryToJsonWithTokenCount,
  scrapeRepositoryToToonWithTokenCount,
  scrapeRepositoryToPlainTextWithTokenCount,
} = require('../dist');

const REPOSITORIES = [
  { name: 'octocat-hello-world', url: 'https://github.com/octocat/Hello-World' },
  { name: 'octocat-spoon-knife', url: 'https://github.com/octocat/Spoon-Knife' },
  { name: 'axios-axios', url: 'https://github.com/axios/axios' },
  { name: 'sindresorhus-slugify', url: 'https://github.com/sindresorhus/slugify' },
  { name: 'lodash-lodash', url: 'https://github.com/lodash/lodash' },
  { name: 'octokit-request', url: 'https://github.com/octokit/request.js' },
];

const FORMATS = [
  {
    key: 'json',
    label: 'JSON',
    run: async (url) => {
      const { files, json, tokenCount } = await scrapeRepositoryToJsonWithTokenCount(url);
      return {
        tokenCount,
        output: json,
        meta: {
          fileCount: files.length,
        },
      };
    },
  },
  {
    key: 'toon',
    label: 'TOON',
    run: async (url) => {
      const { toon, tokenCount } = await scrapeRepositoryToToonWithTokenCount(url);
      return {
        tokenCount,
        output: toon,
      };
    },
  },
  {
    key: 'text',
    label: 'Plain Text',
    run: async (url) => {
      const { text, tokenCount } = await scrapeRepositoryToPlainTextWithTokenCount(url);
      return {
        tokenCount,
        output: text,
      };
    },
  },
];

function formatDuration(ms) {
  return `${ms.toFixed(2)}ms`;
}

function renderMarkdown(summary) {
  const lines = [
    '# git-repo-parser Benchmark',
    '',
    `Generated: ${summary.generatedAt}`,
    '',
  ];

  for (const repo of summary.repositories) {
    lines.push(`## ${repo.name}`);
    lines.push('');
    lines.push(`Repository: ${repo.url}`);
    lines.push('');
    lines.push('| Format | Duration | Token Count | Output Bytes | Extra |');
    lines.push('| --- | ---: | ---: | ---: | --- |');

    for (const result of repo.results) {
      lines.push(
        `| ${result.formatLabel} | ${formatDuration(result.durationMs)} | ${result.tokenCount.toLocaleString()} | ${result.outputBytes.toLocaleString()} | ${result.extra ?? ''} |`,
      );
    }

    if (repo.error) {
      lines.push('');
      lines.push(`⚠️ Error: ${repo.error}`);
    }

    lines.push('');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

async function main() {
  const outDir = path.join(process.cwd(), 'benchmark');
  await fs.mkdir(outDir, { recursive: true });

  const summary = {
    generatedAt: new Date().toISOString(),
    repositories: [],
  };

  for (const repo of REPOSITORIES) {
    const repoSummary = {
      name: repo.name,
      url: repo.url,
      results: [],
      error: null,
    };

    console.log(`Benchmarking ${repo.url} ...`);

    for (const format of FORMATS) {
      const start = performance.now();
      try {
        const output = await format.run(repo.url);
        const durationMs = performance.now() - start;
        const outputBytes = Buffer.byteLength(output.output, 'utf-8');

        repoSummary.results.push({
          format: format.key,
          formatLabel: format.label,
          durationMs,
          tokenCount: output.tokenCount,
          outputBytes,
          extra: output.meta?.fileCount ? `files: ${output.meta.fileCount}` : undefined,
        });

        const previewPath = path.join(outDir, `${repo.name}.${format.key}.preview.txt`);
        const previewLines = output.output.split('\n').slice(0, 100).join('\n');
        await fs.writeFile(
          previewPath,
          `${previewLines}${previewLines.endsWith('\n') ? '' : '\n'}`,
          { encoding: 'utf-8' },
        );
      } catch (error) {
        const durationMs = performance.now() - start;
        repoSummary.results.push({
          format: format.key,
          formatLabel: format.label,
          durationMs,
          tokenCount: 0,
          outputBytes: 0,
          extra: `error`,
        });
        repoSummary.error = error.stack ?? String(error);
        console.error(`  Failed on ${format.label}:`, error);
        break;
      }
    }

    summary.repositories.push(repoSummary);
  }

  const jsonPath = path.join(outDir, 'results.json');
  const mdPath = path.join(outDir, 'results.md');

  await fs.writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, { encoding: 'utf-8' });
  await fs.writeFile(mdPath, renderMarkdown(summary), { encoding: 'utf-8' });

  console.log(`Benchmark complete. Results saved to:`);
  console.log(`  - ${jsonPath}`);
  console.log(`  - ${mdPath}`);
  console.log(`  - ${outDir}/*.preview.txt`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

