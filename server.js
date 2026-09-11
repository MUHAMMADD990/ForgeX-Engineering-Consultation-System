const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'shared-db.json');
const PORT = process.env.PORT || 3000;

const DEFAULT_STATE = {
  initialized: false,
  customers: [],
  projects: [],
  consultations: [],
  attachments: [],
  reports: [],
  meetings: [],
  settings: {},
  users: [],
  draft: null,
  meta: {},
  autoBackup: null
};

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_STATE, null, 2), 'utf8');
  }
}

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function normalizeState(input) {
  const source = input && typeof input === 'object' ? input : {};
  const next = cloneDefaultState();

  next.initialized = !!source.initialized;
  next.customers = Array.isArray(source.customers) ? source.customers : [];
  next.projects = Array.isArray(source.projects) ? source.projects : [];
  next.consultations = Array.isArray(source.consultations) ? source.consultations : [];
  next.attachments = Array.isArray(source.attachments) ? source.attachments : [];
  next.reports = Array.isArray(source.reports) ? source.reports : [];
  next.meetings = Array.isArray(source.meetings) ? source.meetings : [];
  next.settings = source.settings && typeof source.settings === 'object' ? source.settings : {};
  next.users = Array.isArray(source.users) ? source.users : [];
  next.draft = source.draft === undefined ? null : source.draft;
  next.meta = source.meta && typeof source.meta === 'object' ? source.meta : {};
  next.autoBackup = source.autoBackup === undefined ? null : source.autoBackup;

  return next;
}

function readState() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch (error) {
    return cloneDefaultState();
  }
}

function writeState(state) {
  ensureDataFile();
  const normalized = normalizeState(state);
  fs.writeFileSync(DATA_FILE, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });

    req.on('error', reject);
  });
}

function serveStaticFile(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let requestedPath = url.pathname === '/' ? '/index.html' : url.pathname;

  const safePath = path.normalize(path.join(ROOT, requestedPath)).replace(/\\/g, '/');

  if (!safePath.startsWith(ROOT.replace(/\\/g, '/'))) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  const filePath = path.join(ROOT, requestedPath);

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.ico': 'image/x-icon'
    };

    res.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(contents);
  });
}

function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (url.pathname === '/api/health') {
    sendJson(res, 200, { ok: true, message: 'ForgeX shared storage is running' });
    return;
  }

  if (url.pathname === '/api/state') {
    if (req.method === 'GET') {
      sendJson(res, 200, readState());
      return;
    }

    if (req.method === 'PUT') {
      readRequestBody(req)
        .then((input) => {
          const nextState = writeState(input || {});
          sendJson(res, 200, { ok: true, state: nextState });
        })
        .catch((error) => {
          sendJson(res, 400, { ok: false, error: error.message || 'Invalid request body' });
        });
      return;
    }
  }

  sendJson(res, 404, { error: 'Not found' });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res);
    return;
  }

  serveStaticFile(req, res);
});

ensureDataFile();

server.listen(PORT, () => {
  console.log(`ForgeX shared storage server running at http://localhost:${PORT}`);
});
