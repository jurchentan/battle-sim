#!/usr/bin/env python3
import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, unquote

ROOT = os.path.dirname(os.path.abspath(__file__))
SCENARIO_DIR = os.path.join(ROOT, "scenarios")
os.makedirs(SCENARIO_DIR, exist_ok=True)


def safe_name(name: str) -> str:
    cleaned = "".join(ch if ch.isalnum() or ch in ("-", "_", " ") else "_" for ch in name).strip()
    cleaned = cleaned.replace(" ", "_")
    return cleaned or "scenario"


class Handler(SimpleHTTPRequestHandler):
    def _json(self, code: int, payload: dict):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length > 0 else b"{}"
        return json.loads(raw.decode("utf-8"))

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/scenarios":
            entries = []
            for name in os.listdir(SCENARIO_DIR):
                if not name.endswith(".json"):
                    continue
                path = os.path.join(SCENARIO_DIR, name)
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    entries.append(
                        {
                            "id": name[:-5],
                            "name": data.get("name", name[:-5]),
                            "updatedAt": int(os.path.getmtime(path) * 1000),
                            "payload": data.get("payload", data),
                        }
                    )
                except Exception:
                    continue
            entries.sort(key=lambda x: x["updatedAt"], reverse=True)
            return self._json(200, {"items": entries})

        if parsed.path.startswith("/api/scenarios/"):
            sid = unquote(parsed.path.split("/api/scenarios/", 1)[1])
            filename = safe_name(sid) + ".json"
            path = os.path.join(SCENARIO_DIR, filename)
            if not os.path.exists(path):
                return self._json(404, {"error": "not_found"})
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return self._json(200, data)

        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/api/scenarios":
            return self._json(404, {"error": "not_found"})
        data = self._read_json()
        name = str(data.get("name", "scenario"))
        payload = data.get("payload")
        if not isinstance(payload, dict):
            return self._json(400, {"error": "invalid_payload"})
        sid = safe_name(name)
        path = os.path.join(SCENARIO_DIR, f"{sid}.json")
        doc = {"id": sid, "name": name, "updatedAt": int(os.path.getmtime(path) * 1000) if os.path.exists(path) else 0, "payload": payload}
        with open(path, "w", encoding="utf-8") as f:
            json.dump(doc, f, indent=2)
        return self._json(200, {"ok": True, "id": sid})

    def do_DELETE(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/scenarios/"):
            return self._json(404, {"error": "not_found"})
        sid = unquote(parsed.path.split("/api/scenarios/", 1)[1])
        filename = safe_name(sid) + ".json"
        path = os.path.join(SCENARIO_DIR, filename)
        if os.path.exists(path):
            os.remove(path)
        return self._json(200, {"ok": True})


if __name__ == "__main__":
    os.chdir(ROOT)
    server = ThreadingHTTPServer(("0.0.0.0", 8080), Handler)
    print("Serving on http://localhost:8080")
    server.serve_forever()
