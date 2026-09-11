from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse
import json
import mimetypes
import os
import threading

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
DATA_FILE = os.path.join(DATA_DIR, 'shared-db.json')
PORT = int(os.environ.get('PORT', '3000'))

DEFAULT_STATE = {
    'initialized': False,
    'customers': [],
    'projects': [],
    'consultations': [],
    'attachments': [],
    'reports': [],
    'meetings': [],
    'settings': {},
    'users': [],
    'draft': None,
    'meta': {},
    'autoBackup': None,
}


def ensure_data_file():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'w', encoding='utf-8') as handle:
            json.dump(DEFAULT_STATE, handle, ensure_ascii=False, indent=2)


def clone_default_state():
    return json.loads(json.dumps(DEFAULT_STATE))


def normalize_state(value):
    source = value if isinstance(value, dict) else {}
    normalized = clone_default_state()

    normalized['initialized'] = bool(source.get('initialized', False))
    normalized['customers'] = source.get('customers', []) if isinstance(source.get('customers', []), list) else []
    normalized['projects'] = source.get('projects', []) if isinstance(source.get('projects', []), list) else []
    normalized['consultations'] = source.get('consultations', []) if isinstance(source.get('consultations', []), list) else []
    normalized['attachments'] = source.get('attachments', []) if isinstance(source.get('attachments', []), list) else []
    normalized['reports'] = source.get('reports', []) if isinstance(source.get('reports', []), list) else []
    normalized['meetings'] = source.get('meetings', []) if isinstance(source.get('meetings', []), list) else []
    normalized['settings'] = source.get('settings', {}) if isinstance(source.get('settings', {}), dict) else {}
    normalized['users'] = source.get('users', []) if isinstance(source.get('users', []), list) else []
    normalized['draft'] = source.get('draft', None)
    normalized['meta'] = source.get('meta', {}) if isinstance(source.get('meta', {}), dict) else {}
    normalized['autoBackup'] = source.get('autoBackup', None)

    return normalized


def load_state():
    ensure_data_file()
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as handle:
            raw = handle.read()
            if not raw.strip():
                return clone_default_state()
            return normalize_state(json.loads(raw))
    except Exception:
        return clone_default_state()


def save_state(state):
    ensure_data_file()
    normalized = normalize_state(state)
    with open(DATA_FILE, 'w', encoding='utf-8') as handle:
        json.dump(normalized, handle, ensure_ascii=False, indent=2)
    return normalized


class SharedStateHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Accept')
        super().end_headers()

    def log_message(self, format, *args):
        return

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/health':
            self._send_json(200, {'ok': True, 'message': 'ForgeX shared storage is running'})
            return

        if parsed.path == '/api/state':
            self._send_json(200, load_state())
            return

        self._serve_static(parsed.path)

    def do_PUT(self):
        parsed = urlparse(self.path)
        if parsed.path != '/api/state':
            self._send_json(404, {'error': 'Not found'})
            return

        try:
            length = int(self.headers.get('Content-Length', '0'))
            raw = self.rfile.read(length) if length else b''
            payload = json.loads(raw.decode('utf-8')) if raw else {}
            state = save_state(payload)
            self._send_json(200, {'ok': True, 'state': state})
        except Exception as exc:
            self._send_json(400, {'ok': False, 'error': str(exc)})

    def _serve_static(self, requested_path):
        normalized = requested_path
        if normalized == '/':
            normalized = '/index.html'

        if normalized.startswith('/'):
            normalized = normalized[1:]

        safe_path = os.path.normpath(os.path.join(BASE_DIR, normalized))
        if os.path.commonpath([BASE_DIR, safe_path]) != BASE_DIR:
            self._send_json(403, {'error': 'Forbidden'})
            return

        if not os.path.exists(safe_path) or os.path.isdir(safe_path):
            self._send_json(404, {'error': 'Not found'})
            return

        mimetype, _ = mimetypes.guess_type(safe_path)
        with open(safe_path, 'rb') as handle:
            data = handle.read()

        self.send_response(200)
        self.send_header('Content-Type', mimetype or 'application/octet-stream')
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        self.wfile.write(data)

    def _send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == '__main__':
    ensure_data_file()
    server = ThreadingHTTPServer(('0.0.0.0', PORT), SharedStateHandler)
    print(f'ForgeX shared storage server running at http://localhost:{PORT}')
    server.serve_forever()
