import {
  applyCorsAndPreflight,
  handleAnalyzeChart,
  parseJsonBody,
  resolveGeminiApiKey,
} from './_lib/investcalBackend.ts';

export default async function handler(req: any, res: any) {
  if (applyCorsAndPreflight(req, res, ['POST', 'OPTIONS'])) return;

  const body = parseJsonBody(req);
  const apiKey = resolveGeminiApiKey(req);
  const { status, payload } = await handleAnalyzeChart(body, apiKey);
  res.status(status).json(payload);
}
