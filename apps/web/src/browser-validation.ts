import { z } from 'zod/v4';

// Browser validation runs under a CSP that disallows dynamic code.
z.config({ jitless: true });

export { z };
