const fs = require('fs/promises');
const path = require('path');
const {
  scrapeRepositoryToJsonWithTokenCount,
  scrapeRepositoryToToonWithTokenCount,
  scrapeRepositoryToPlainTextWithTokenCount,
} = require('./dist');

const OUTPUT_FILE = path.join(process.cwd(), 'output.txt');
const MAX_PREVIEW_LINES = 50;

function previewLines(content, maxLines = MAX_PREVIEW_LINES) {
  return content.split('\n').slice(0, maxLines).join('\n');
}

async function main() {
  const repoUrl = process.argv[2] ?? 'https://github.com/kitops-ml/gh-kit-setup';

  const sections = [];
  sections.push(`# git-repo-parser sample export
Repository: ${repoUrl}
Generated: ${new Date().toISOString()}
`);

  const { json, tokenCount: jsonTokens } = await scrapeRepositoryToJsonWithTokenCount(repoUrl);
  sections.push(`## JSON Export
Token usage (cl100k_base): ${jsonTokens}
Preview (first ${MAX_PREVIEW_LINES} lines):

${previewLines(json)}
`);

  const { toon, tokenCount: toonTokens } = await scrapeRepositoryToToonWithTokenCount(repoUrl);
  sections.push(`## TOON Export
Token usage (cl100k_base): ${toonTokens}
Preview (first ${MAX_PREVIEW_LINES} lines):

${previewLines(toon)}
`);

  const { text, tokenCount: textTokens } = await scrapeRepositoryToPlainTextWithTokenCount(repoUrl);
  sections.push(`## Plain Text Export
Token usage (cl100k_base): ${textTokens}
Preview (first ${MAX_PREVIEW_LINES} lines):

${previewLines(text)}
`);

  const body = sections.join('\n');
  await fs.writeFile(OUTPUT_FILE, `${body.trimEnd()}\n`, { encoding: 'utf-8' });
  console.log(`Output written to ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});