#!/usr/bin/env python3
"""Skill Hub 本地启动器

特点：对所有响应加 no-store，改完文件刷新即生效，不会再出现
"detail.js 已是新版、components.js 还是缓存旧版"导致的报错。

用法：
    python serve.py            # 默认 8765
    PORT=9000 python serve.py  # 指定端口
"""

import http.server
import os
import socketserver
import sys
import webbrowser
from functools import partial

PORT = int(os.environ.get("PORT", "8765"))
ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # 输出保持安静，避免刷屏
        pass


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main():
    handler = partial(Handler, directory=ROOT)
    try:
        httpd = Server(("127.0.0.1", PORT), handler)
    except OSError as err:
        print(f"端口 {PORT} 无法使用：{err}")
        print(f"换一个端口试试，例如：PORT=9000 python {os.path.basename(__file__)}")
        sys.exit(1)

    url = f"http://127.0.0.1:{PORT}/index.html"
    print(f"Skill Hub 已启动：{url}")
    print("（已禁用缓存，改完代码直接刷新即可）  按 Ctrl+C 停止")

    try:
        if "--no-open" not in sys.argv:
            webbrowser.open(url)
    except Exception:
        pass

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
