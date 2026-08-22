export interface SentencePiecePiece {
    piece: string;
    score: number;
}

const enum WireType {
    Varint = 0,
    Fixed64 = 1,
    LengthDelimited = 2,
    Fixed32 = 5,
}

function readVarint(buf: Uint8Array, pos: number): [number, number] {
    let result = 0;
    let shift = 0;
    for (;;) {
        const byte = buf[pos++];
        result += (byte & 0x7f) * 2 ** shift;
        if ((byte & 0x80) === 0) return [result, pos];
        shift += 7;
    }
}

function skipField(buf: Uint8Array, pos: number, wire: number): number {
    switch (wire) {
        case WireType.Varint:
            return readVarint(buf, pos)[1];
        case WireType.Fixed64:
            return pos + 8;
        case WireType.LengthDelimited: {
            const [length, next] = readVarint(buf, pos);
            return next + length;
        }
        case WireType.Fixed32:
            return pos + 4;
        default:
            throw new Error(`Champ protobuf inattendu: ${wire}`);
    }
}

function parsePiece(
    buf: Uint8Array,
    view: DataView,
    start: number,
    end: number,
): SentencePiecePiece {
    let pos = start;
    let piece = '';
    let score = 0;

    while (pos < end) {
        const [tag, next] = readVarint(buf, pos);
        pos = next;
        const field = tag >> 3;
        const wire = tag & 7;

        if (field === 1 && wire === WireType.LengthDelimited) {
            const [length, afterLength] = readVarint(buf, pos);
            piece = new TextDecoder().decode(buf.subarray(afterLength, afterLength + length));
            pos = afterLength + length;
        } else if (field === 2 && wire === WireType.Fixed32) {
            score = view.getFloat32(buf.byteOffset + pos, true);
            pos += 4;
        } else {
            pos = skipField(buf, pos, wire);
        }
    }

    return { piece, score };
}

/**
 * Reads the pieces out of a SentencePiece ModelProto. Upstream converts this file to JSON for
 * the same reason: it avoids a protobuf and a sentencepiece dependency for one flat list.
 */
export function parseSentencePieceModel(buffer: ArrayBuffer): SentencePiecePiece[] {
    const buf = new Uint8Array(buffer);
    const view = new DataView(buffer);
    const pieces: SentencePiecePiece[] = [];
    let pos = 0;

    while (pos < buf.length) {
        const [tag, next] = readVarint(buf, pos);
        pos = next;
        const field = tag >> 3;
        const wire = tag & 7;

        if (field === 1 && wire === WireType.LengthDelimited) {
            const [length, afterLength] = readVarint(buf, pos);
            pieces.push(parsePiece(buf, view, afterLength, afterLength + length));
            pos = afterLength + length;
        } else {
            pos = skipField(buf, pos, wire);
        }
    }

    return pieces;
}
