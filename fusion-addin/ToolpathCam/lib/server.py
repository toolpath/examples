"""Serves the web build on localhost, giving the palettes an origin the API key can allow."""

import functools
import http.server
import os
import threading

_server = None
_thread = None


class _Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, format, *args):
        pass


def start(directory: str, port: int) -> str:
    global _server, _thread
    if _server is not None:
        return url(port)

    if not os.path.isfile(os.path.join(directory, "index.html")):
        raise FileNotFoundError(
            f"No web build found at {directory}. Run `pnpm --filter @toolpath/example-fusion-addin build` first."
        )

    handler = functools.partial(_Handler, directory=directory)
    _server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    _server.daemon_threads = True
    _thread = threading.Thread(target=_server.serve_forever, name="ToolpathCamStatic", daemon=True)
    _thread.start()
    return url(port)


def stop():
    global _server, _thread
    if _server is None:
        return
    _server.shutdown()
    _server.server_close()
    _server = None
    _thread = None


def url(port: int) -> str:
    return f"http://localhost:{port}/"
