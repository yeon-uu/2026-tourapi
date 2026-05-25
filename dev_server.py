"""개발용 프론트엔드 서버 — 정적 파일 서빙 + API 프록시 (nginx 대체)"""
import http.server
import socketserver
import urllib.request
import urllib.error
import sys
import traceback

API_HOST = "http://localhost:8001"
FRONTEND_DIR = "frontend"
PORT = 3000


class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True


class DevHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=FRONTEND_DIR, **kwargs)

    def log_message(self, format, *args):
        sys.stderr.write("[dev] %s - %s\n" % (self.client_address[0], format % args))
        sys.stderr.flush()

    def do_request(self, method):
        if self.path.startswith("/api/") or self.path == "/health":
            # API 프록시
            url = API_HOST + self.path
            headers = {}
            for key in ["Authorization", "Content-Type"]:
                val = self.headers.get(key)
                if val:
                    headers[key] = val

            body = None
            content_length = self.headers.get("Content-Length")
            if content_length:
                body = self.rfile.read(int(content_length))

            try:
                req = urllib.request.Request(url, data=body, headers=headers, method=method)
                with urllib.request.urlopen(req, timeout=30) as resp:
                    resp_body = resp.read()
                    self.send_response(resp.status)
                    for key, val in resp.getheaders():
                        if key.lower() not in ("transfer-encoding", "connection"):
                            self.send_header(key, val)
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.end_headers()
                    self.wfile.write(resp_body)
            except urllib.error.HTTPError as e:
                err_body = e.read()
                self.send_response(e.code)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(err_body)
            except Exception as e:
                traceback.print_exc()
                self.send_response(502)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"detail":"Proxy error"}')
        else:
            # 정적 파일
            if method == "GET":
                super().do_GET()

    def do_GET(self):
        self.do_request("GET")

    def do_POST(self):
        self.do_request("POST")

    def do_PATCH(self):
        self.do_request("PATCH")

    def do_PUT(self):
        self.do_request("PUT")

    def do_DELETE(self):
        self.do_request("DELETE")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.end_headers()


if __name__ == "__main__":
    print(f"Dev server: http://localhost:{PORT}")
    print(f"API proxy -> {API_HOST}")
    server = ThreadingHTTPServer(("", PORT), DevHandler)
    server.serve_forever()
