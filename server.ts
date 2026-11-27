import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  applyCorsAndPreflight,
  getHealthPayload,
  handleAnalyzeChart,
  handleBatchedSync,
  handleChartData,
  handleClassifyAsset,
  parseJsonBody,
  resolveGeminiApiKey,
} from './api/_lib/investcalBackend.ts';
import {
  applyAuthenticatedCorsAndPreflight,
  extractBearerToken,
  handleUserSync,
} from './api/_lib/userSyncBackend.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.all('/api/health', (req, res) => {
    if (applyCorsAndPreflight(req, res, ['GET', 'OPTIONS'])) return;
    res.status(200).json(getHealthPayload());
  });

  // 1. Global Asset Lookup: Yahoo Finance Autocomplete + optional Gemini enrichment (NO googleSearch)
  app.all('/api/classify-asset', async (req, res) => {
    if (applyCorsAndPreflight(req, res, ['POST', 'OPTIONS'])) return;
    const { status, payload } = await handleClassifyAsset(
      parseJsonBody(req),
      resolveGeminiApiKey(req)
    );
    res.status(status).json(payload);
  });

  // 2. SINGLE BATCHED SYNC: ForexFactory UTC+7 Calendar + Google News RSS + Yahoo Finance + 1 Gemini JSON Request
  app.all('/api/batched-sync', async (req, res) => {
    if (applyCorsAndPreflight(req, res, ['POST', 'OPTIONS'])) return;
    const { status, payload } = await handleBatchedSync(
      parseJsonBody(req),
      resolveGeminiApiKey(req)
    );
    res.status(status).json(payload);
  });

  // 3. Historical OHLCV Candles from Yahoo Finance (1D / 4H / 1H — 0% AI Quota)
  app.all('/api/chart-data', async (req, res) => {
    if (applyCorsAndPreflight(req, res, ['POST', 'OPTIONS'])) return;
    const { status, payload } = await handleChartData(parseJsonBody(req));
    res.status(status).json(payload);
  });

  // Backward-compatible alias for /api/chart-history
  app.all('/api/chart-history', async (req, res) => {
    if (applyCorsAndPreflight(req, res, ['POST', 'OPTIONS'])) return;
    const { status, payload } = await handleChartData(parseJsonBody(req));
    res.status(status).json(payload);
  });

  // 4. On-Demand AI Technical & Fibonacci Plan (1 Single Request, NO googleSearch)
  app.all('/api/analyze-chart', async (req, res) => {
    if (applyCorsAndPreflight(req, res, ['POST', 'OPTIONS'])) return;
    const { status, payload } = await handleAnalyzeChart(
      parseJsonBody(req),
      resolveGeminiApiKey(req)
    );
    res.status(status).json(payload);
  });

  // 5. Cross-Device User Membership & Portfolio Cloud Sync via Upstash Redis REST API
  app.all('/api/user-sync', async (req, res) => {
    if (applyAuthenticatedCorsAndPreflight(req, res)) return;
    const { status, payload } = await handleUserSync(
      parseJsonBody(req),
      extractBearerToken(req)
    );
    res.status(status).json(payload);
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    const health = getHealthPayload();
    console.log(
      `InvestCal server running on http://0.0.0.0:${PORT} (${health.model}, Serverless-Shared /api/* + Free RSS + Yahoo OHLCV)`
    );
  });
}

startServer();
