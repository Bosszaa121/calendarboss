import {
  applyCorsAndPreflight,
  handleChartData,
  parseJsonBody,
} from './_lib/investcalBackend.ts';

export default async function handler(req: any, res: any) {
  if (applyCorsAndPreflight(req, res, ['POST', 'OPTIONS'])) return;

  const body = parseJsonBody(req);
  const { status, payload } = await handleChartData(body);
  res.status(status).json(payload);
}
