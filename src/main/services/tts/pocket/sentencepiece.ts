import { parseSentencePieceModel, type SentencePiecePiece } from './tokenizer-model';

const SPACE = '▁';
const UNKNOWN = '<unk>';
const BYTE_PIECE = /^<0x([0-9A-Fa-f]{2})>$/;

interface Node {
    score: number;
    start: number;
}

/**
 * SentencePiece unigram inference: a Viterbi segmentation over the vocabulary, with the
 * byte pieces as the fallback for anything the vocabulary does not cover.
 */
export class SentencePieceTokenizer {
    private readonly idOf = new Map<string, number>();
    private readonly scoreOf = new Map<string, number>();
    private readonly pieceOf: string[];
    private readonly longestPiece: number;

    constructor(pieces: SentencePiecePiece[]) {
        this.pieceOf = pieces.map((entry) => entry.piece);
        let longest = 1;
        pieces.forEach((entry, id) => {
            this.idOf.set(entry.piece, id);
            this.scoreOf.set(entry.piece, entry.score);
            const length = [...entry.piece].length;
            if (length > longest) longest = length;
        });
        this.longestPiece = longest;
    }

    static fromModel(buffer: ArrayBuffer): SentencePieceTokenizer {
        return new SentencePieceTokenizer(parseSentencePieceModel(buffer));
    }

    encode(text: string): number[] {
        if (!text.trim()) return [];
        const symbols = [...normalize(text)];
        if (symbols.length === 0) return [];

        const best: (Node | null)[] = new Array(symbols.length + 1).fill(null);
        best[0] = { score: 0, start: 0 };

        for (let end = 1; end <= symbols.length; end++) {
            const from = Math.max(0, end - this.longestPiece);
            for (let start = from; start < end; start++) {
                const previous = best[start];
                if (!previous) continue;

                const candidate = symbols.slice(start, end).join('');
                const score = this.scoreOf.get(candidate);
                if (score === undefined) continue;

                const total = previous.score + score;
                if (!best[end] || total > best[end]!.score) {
                    best[end] = { score: total, start };
                }
            }

            // Nothing in the vocabulary reaches here: fall back to this single symbol.
            if (!best[end] && best[end - 1]) {
                best[end] = { score: best[end - 1]!.score - 10, start: end - 1 };
            }
        }

        const segments: string[] = [];
        for (let end = symbols.length; end > 0;) {
            const node = best[end]!;
            segments.push(symbols.slice(node.start, end).join(''));
            end = node.start;
        }
        segments.reverse();

        return segments.flatMap((segment) => this.toIds(segment));
    }

    decode(ids: number[]): string {
        const bytes: number[] = [];
        for (const id of ids) {
            const piece = this.pieceOf[id];
            if (piece === undefined) continue;

            const byte = BYTE_PIECE.exec(piece);
            if (byte) {
                bytes.push(Number.parseInt(byte[1], 16));
                continue;
            }
            bytes.push(...new TextEncoder().encode(piece));
        }
        return new TextDecoder().decode(new Uint8Array(bytes)).replaceAll(SPACE, ' ').trimStart();
    }

    private toIds(segment: string): number[] {
        const id = this.idOf.get(segment);
        if (id !== undefined) return [id];

        const fallback: number[] = [];
        for (const byte of new TextEncoder().encode(segment)) {
            const byteId = this.idOf.get(`<0x${byte.toString(16).toUpperCase().padStart(2, '0')}>`);
            if (byteId !== undefined) fallback.push(byteId);
        }
        if (fallback.length > 0) return fallback;

        const unknown = this.idOf.get(UNKNOWN);
        return unknown === undefined ? [] : [unknown];
    }
}

function normalize(text: string): string {
    return SPACE + text.normalize('NFKC').replace(/\s+/g, ' ').trimStart().replaceAll(' ', SPACE);
}
