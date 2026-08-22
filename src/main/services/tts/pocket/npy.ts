export interface NpyArray {
    data: Float32Array;
    shape: number[];
}

const MAGIC = [0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59];

export function parseNpyFloat32(buffer: ArrayBuffer): NpyArray {
    const view = new DataView(buffer);
    const magic = new Uint8Array(buffer, 0, MAGIC.length);
    if (MAGIC.some((byte, i) => magic[i] !== byte)) {
        throw new Error('Fichier NPY invalide.');
    }

    const major = view.getUint8(6);
    const headerLength = major === 1 ? view.getUint16(8, true) : view.getUint32(8, true);
    const headerOffset = major === 1 ? 10 : 12;
    const header = new TextDecoder().decode(new Uint8Array(buffer, headerOffset, headerLength));

    const shapeMatch = /\(\s*([0-9,\s]*)\)/.exec(header);
    if (!shapeMatch) throw new Error('Forme NPY illisible.');

    const shape = shapeMatch[1]
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => Number.parseInt(part, 10));

    return {
        data: new Float32Array(buffer.slice(headerOffset + headerLength)),
        shape,
    };
}
