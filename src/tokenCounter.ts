import { encode } from 'gpt-tokenizer';

export interface TokenCountOptions {
    /**
     * Optional delimiter to join multiple segments prior to tokenising.
     * Defaults to a single newline.
     */
    joinWith?: string;
}

export function countTokens(
    segments: string | string[],
    { joinWith = '\n' }: TokenCountOptions = {}
): number {
    const text = Array.isArray(segments) ? segments.join(joinWith) : segments;
    return encode(text).length;
}

