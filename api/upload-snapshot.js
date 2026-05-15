/**
 * COSMIC ROLL — ULTIMATE  ·  Vercel Edition
 * api/upload-snapshot.js
 *
 * Vercel Serverless Function (CommonJS — flat, no ESM)
 * POST /api/upload-snapshot
 * Body: { dataUrl: "data:image/jpeg;base64,...", gameState: {...} }
 */

'use strict';

const https = require('https');

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN
                 || 'vercel_blob_rw_NjmwaaFYFZ4Pbn0E_qIoOMWE7XQZTLxJBjq8GHT9OmV60mF';
const BLOB_HOST  = 'blob.vercel-storage.com';

module.exports.config = {
  api: { bodyParser: { sizeLimit: '8mb' } },
};

function blobPut(blobPathname, buffer, contentType) {
  return new Promise(function(resolve, reject) {
    var req = https.request(
      {
        hostname : BLOB_HOST,
        port     : 443,
        path     : '/' + blobPathname,
        method   : 'PUT',
        headers  : {
          'Authorization'           : 'Bearer ' + BLOB_TOKEN,
          'Content-Type'            : contentType,
          'Content-Length'          : buffer.length,
          'x-api-version'           : '7',
          'x-add-random-suffix'     : 'false',
          'x-cache-control-max-age' : '0',
        },
      },
      function(res) {
        var chunks = [];
        res.on('data', function(c) { chunks.push(c); });
        res.on('end', function() {
          var raw = Buffer.concat(chunks).toString('utf8');
          try   { resolve(JSON.parse(raw)); }
          catch (e) { resolve({ url: null, _raw: raw }); }
        });
      }
    );
    req.on('error', reject);
    req.write(buffer);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST')   { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    var body    = req.body || {};
    var dataUrl = body.dataUrl || '';
    var match   = dataUrl.match(/^data:(image\/[\w+]+);base64,(.+)$/s);
    if (!match) { res.status(400).json({ error: 'Invalid or missing dataUrl' }); return; }

    var mimeType    = match[1];
    var ext         = mimeType.split('/')[1];
    var imageBuffer = Buffer.from(match[2], 'base64');

    var now      = new Date();
    var dateStr  = now.toISOString().slice(0, 10);
    var timeStr  = now.toISOString().slice(11, 23).replace(/:/g, '-').replace('.', '-');
    var blobPath = 'cosmic-roll/snapshots/' + dateStr + '/' + timeStr + '.' + ext;

    var result  = await blobPut(blobPath, imageBuffer, mimeType);
    var blobUrl = result.url || result.downloadUrl || null;

    res.status(200).json({
      success : !!blobUrl,
      url     : blobUrl,
      path    : blobPath,
      size    : imageBuffer.length,
      ts      : now.toISOString(),
    });
  } catch (err) {
    console.error('[upload-snapshot]', err.message);
    res.status(500).json({ error: err.message });
  }
};
