// pages/api/render.js
//
// HTML -> PDF rendering endpoint for the digital product factory.
// Called by n8n's "Chromium PDF Renderer" node with { html, filename }.
//
// SECURITY: this endpoint now requires a shared secret on every request.
// Set RENDER_API_SECRET in your Vercel project's Environment Variables
// (Project Settings -> Environment Variables) to the value your n8n
// workflow sends in the X-Render-Secret header. Without this check,
// anyone with the URL could make your Vercel function render arbitrary
// HTML at your expense - this was flagged as an open production-readiness
// gap and should not be left unauthenticated.

import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb', // generous headroom for a 6-8 page styled HTML document
    },
  },
};

function timingSafeEqual(a, b) {
  // Avoids leaking the secret's length/content via response-time differences.
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  if (bufA.length !== bufB.length) {
    // Still run a comparison of equal length to keep timing roughly constant.
    Buffer.compare(bufA, bufA);
    return false;
  }
  const crypto = require('crypto');
  return crypto.timingSafeEqual(bufA, bufB);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // --- Auth check: shared secret required on every call ---
  const expectedSecret = process.env.RENDER_API_SECRET;
  if (!expectedSecret) {
    // Fail closed: if the env var isn't set, refuse to render rather than
    // silently running unauthenticated.
    console.error('RENDER_API_SECRET is not configured on this deployment');
    return res.status(500).json({ error: 'Render endpoint is not configured' });
  }
  const providedSecret = req.headers['x-render-secret'];
  if (!providedSecret || !timingSafeEqual(providedSecret, expectedSecret)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // --- End auth check ---

  const { html, filename } = req.body || {};

  if (!html || typeof html !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "html" field' });
  }

  const safeFilename = String(filename || 'product.pdf')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-') || 'product.pdf';

  let browser = null;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });

    await browser.close();
    browser = null;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error('PDF render failed:', err);
    return res.status(500).json({ error: 'PDF rendering failed', details: String(err && err.message || err) });
  } finally {
    if (browser) {
      try { await browser.close(); } catch (_) { /* already closed */ }
    }
  }
}
