export type DocumentationOptions = { environment?: string; enableDocs?: boolean };

export function documentationEnabled(options: DocumentationOptions) {
    return options.environment === 'development' && options.enableDocs === true;
}

export function apiListenHost(options: DocumentationOptions) {
    return documentationEnabled(options) ? '127.0.0.1' : '0.0.0.0';
}
