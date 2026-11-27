import { parseJsonBody } from './_lib/investcalBackend.ts';
import {
  applyAuthenticatedCorsAndPreflight,
  extractBearerToken,
  handleUserSync,
} from './_lib/userSyncBackend.ts';

export default async function handler(req: any, res: any) {
  if (applyAuthenticatedCorsAndPreflight(req, res)) return;

  const body = parseJsonBody(req);
  const bearerToken = extractBearerToken(req);
  const { status, payload } = await handleUserSync(body, bearerToken);
  res.status(status).json(payload);
}
