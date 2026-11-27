import { applyCorsAndPreflight, getHealthPayload } from './_lib/investcalBackend.ts';

export default function handler(req: any, res: any) {
  if (applyCorsAndPreflight(req, res, ['GET', 'OPTIONS'])) return;
  res.status(200).json(getHealthPayload());
}
