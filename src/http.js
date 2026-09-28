import { evaluateApplication } from './decision.js';
import { ValidationError } from './validation.js';

const route = '/api/underwriting/decision';
const limit = 16384;
const errors = {
  MALFORMED_JSON: 'Request body must be valid JSON.',
  UNSUPPORTED_CONTENT_TYPE: 'Content-Type must be application/json.',
  REQUEST_TOO_LARGE: 'Request body exceeds 16384 bytes.',
  NOT_FOUND: 'Route not found.',
  METHOD_NOT_ALLOWED: 'Method must be POST.',
  INTERNAL_ERROR: 'Internal server error.',
};
function send(res, status, body, headers = {}) {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}
function fail(res, status, code, headers) {
  send(res, status, { error: { code, message: errors[code], details: [] } }, headers);
}

export function createHandler(evaluate = evaluateApplication) {
  return function handler(req, res) {
    let finished = false;
    let size = 0;
    let chunks = [];
    const stop = () => { finished = true; chunks = []; };
    req.on('error', stop);
    req.on('aborted', stop);
    if (req.url.split('?')[0] !== route) {
      fail(res, 404, 'NOT_FOUND'); req.resume(); return;
    }
    if (req.method !== 'POST') {
      fail(res, 405, 'METHOD_NOT_ALLOWED', { Allow: 'POST' }); req.resume(); return;
    }
    if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      fail(res, 400, 'UNSUPPORTED_CONTENT_TYPE'); req.resume(); return;
    }
    req.on('data', chunk => {
      if (finished) return;
      size += chunk.length;
      if (size > limit) {
        stop(); fail(res, 400, 'REQUEST_TOO_LARGE'); return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (finished) return;
      const body = Buffer.concat(chunks).toString('utf8');
      stop();
      let input;
      try { input = JSON.parse(body); }
      catch { fail(res, 400, 'MALFORMED_JSON'); return; }
      try { send(res, 200, evaluate(input)); }
      catch (error) {
        if (error instanceof ValidationError) {
          send(res, 400, { error: { code: 'VALIDATION_ERROR', message: error.message, details: error.details } });
        } else {
          fail(res, 500, 'INTERNAL_ERROR');
        }
      }
    });
  };
}
export const handler = createHandler();
