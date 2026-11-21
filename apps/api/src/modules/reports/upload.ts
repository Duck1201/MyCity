import busboy from 'busboy';
import type { IncomingHttpHeaders } from 'node:http';
import sharp from 'sharp';
import { reportMetadataSchema } from '@mycity/contracts';
import { createHash } from 'node:crypto';
import { thumbnailOf } from './thumbnail.js';

export class ReportError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
    ) {
        super(message);
    }
}
export const badInput = (message: string) => new ReportError(422, 'VALIDATION_ERROR', message);
const maxPhoto = 5 * 1024 * 1024;

// The router bounds the entire body, including multipart overhead, before parsing.
function parts(headers: IncomingHttpHeaders, body: Buffer) {
    return new Promise<{ metadata: string; photos: Buffer[] }>((resolve, reject) => {
        const parser = busboy({ headers, limits: { files: 3, fields: 1, parts: 5, fieldSize: 16 * 1024, fileSize: maxPhoto + 1 } });
        const photos: Buffer[] = [];
        let metadata: string | undefined;
        let invalid = false;
        parser.on('field', (name, value, info) => {
            if (name !== 'metadata' || info.valueTruncated || metadata !== undefined) invalid = true;
            metadata = value;
        });
        parser.on('file', (name, stream, info) => {
            if (name !== 'photos' || info.mimeType !== 'image/jpeg') invalid = true;
            const chunks: Buffer[] = [];
            const position = photos.length;
            photos.push(Buffer.alloc(0));
            stream.on('data', (chunk: Buffer) => chunks.push(chunk));
            stream.on('limit', () => {
                invalid = true;
            });
            stream.on('error', reject);
            stream.on('end', () => {
                const photo = Buffer.concat(chunks);
                if (!photo.length || photo.length > maxPhoto) invalid = true;
                photos[position] = photo;
            });
        });
        for (const name of ['partsLimit', 'filesLimit', 'fieldsLimit'])
            parser.on(name, () => {
                invalid = true;
            });
        parser.on('error', reject);
        parser.on('close', () => {
            if (invalid || !metadata || !photos.length) reject(badInput('Envie os dados da denúncia e entre uma e três fotos JPEG de até 5 MiB.'));
            else resolve({ metadata, photos });
        });
        parser.end(body);
    });
}

export async function parseUpload(headers: IncomingHttpHeaders, body: Buffer) {
    let multipart;
    try {
        multipart = await parts(headers, body);
    } catch (error) {
        if (error instanceof ReportError) throw error;
        throw badInput('Envio multipart inválido.');
    }
    let input: unknown;
    try {
        input = JSON.parse(multipart.metadata);
    } catch {
        throw badInput('Os dados da denúncia devem estar em JSON.');
    }
    return prepareReportInput(input, multipart.photos);
}

export async function prepareReportInput(input: unknown, originals: Buffer[]) {
    if (originals.length < 1 || originals.length > 3 || originals.some((photo) => !photo.length || photo.length > maxPhoto)) {
        throw badInput('Envie de uma a três fotos JPEG de até 5 MiB.');
    }
    const parsed = reportMetadataSchema.safeParse(input);
    if (!parsed.success) throw badInput('Confira a categoria, descrição, localização e identificação.');
    const hash = createHash('sha256').update(JSON.stringify(parsed.data));
    const photos = [];
    for (const source of originals) {
        hash.update(createHash('sha256').update(source).digest());
        try {
            const image = sharp(source, { limitInputPixels: 1600 * 1600, failOn: 'warning' });
            const metadata = await image.metadata();
            if (metadata.format !== 'jpeg' || metadata.width > 1600 || metadata.height > 1600) throw badInput('A foto deve ser JPEG com maior lado de até 1.600 pixels.');
            const { data, info } = await image.autoOrient().jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true });
            if (data.length > maxPhoto) throw badInput('Foto maior que o limite de 5 MiB.');
            photos.push({ data, thumbnail: await thumbnailOf(data), width: info.width, height: info.height });
        } catch (error) {
            if (error instanceof ReportError) throw error;
            throw badInput('Não foi possível ler a foto JPEG.');
        }
    }
    return { metadata: parsed.data, photos, requestHash: hash.digest('hex') };
}
