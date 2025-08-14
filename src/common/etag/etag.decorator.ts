import { SetMetadata } from '@nestjs/common';

export const ETAG_RESOURCE_KEY = 'etag:resource';

export const EtagResource = (key: string) => SetMetadata(ETAG_RESOURCE_KEY, key);
