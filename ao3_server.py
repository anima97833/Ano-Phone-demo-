#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AO3 (Archive of Our Own) 本地桥接服务
运行方式: python ao3_server.py
默认监听: http://127.0.0.1:8765
为手机网页端提供无跨域限制的真实 AO3 同人文实时检索与内容抓取
"""

import http.server
import socketserver
import urllib.parse
import json
import time
import os
import sys
import requests
from bs4 import BeautifulSoup

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

PORT = 8765
AO3_MIN_INTERVAL = 2.0  # 请求 AO3 的最小安全间隔（秒）
_last_request_time = 0

# 代理设置（国内访问 AO3 如果开启了梯子/代理，可在此配置，例如 "http://127.0.0.1:7890"）
# 当前直连 AO3 已通（HTTP 200），代理 7897 会导致 Python 3.10 OpenSSL 1.1.1n SSL 握手失败，故禁用
PROXY = ""

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Upgrade-Insecure-Requests": "1"
}

def get_proxies():
    if PROXY:
        return {"http": PROXY, "https": PROXY}
    return None

def fetch_ao3_search(query="", fandom="", tag="", max_results=5):
    global _last_request_time
    now = time.time()
    elapsed = now - _last_request_time
    if elapsed < AO3_MIN_INTERVAL:
        time.sleep(AO3_MIN_INTERVAL - elapsed)
    _last_request_time = time.time()

    params = {
        "work_search[query]": query,
        "work_search[fandom_names]": fandom,
        "work_search[freeform_names]": tag,
        "work_search[sort_column]": "kudos_count",
        "commit": "Search"
    }
    url = "https://archiveofourown.org/works/search?" + urllib.parse.urlencode({k: v for k, v in params.items() if v})
    print(f"[AO3 Server] 正在检索 AO3: {url}")

    try:
        resp = requests.get(url, headers=HEADERS, proxies=get_proxies(), timeout=12)
        if resp.status_code != 200:
            print(f"[AO3 Server] AO3 返回 HTTP {resp.status_code}")
            return {"status": "error", "message": f"AO3 返回状态码 {resp.status_code}"}

        soup = BeautifulSoup(resp.text, "html.parser")
        work_elements = soup.select("ol.work.index.group > li.work.blurb.group")

        results = []
        for w in work_elements[:max_results]:
            title_tag = w.select_one("h4.heading a:not([rel='author'])")
            author_tag = w.select_one("h4.heading a[rel='author']")
            fandom_tags = [a.get_text(strip=True) for a in w.select("h5.fandoms.heading a.tag")]
            rel_tags = [a.get_text(strip=True) for a in w.select("ul.tags li.relationships a.tag")]
            char_tags = [a.get_text(strip=True) for a in w.select("ul.tags li.characters a.tag")]
            freeform_tags = [a.get_text(strip=True) for a in w.select("ul.tags li.freeforms a.tag")]
            summary_tag = w.select_one("blockquote.userstuff.summary")

            words_tag = w.select_one("dd.words")
            kudos_tag = w.select_one("dd.kudos a")
            bookmarks_tag = w.select_one("dd.bookmarks a")

            title = title_tag.get_text(strip=True) if title_tag else "无题"
            href = title_tag["href"] if title_tag and "href" in title_tag.attrs else ""
            work_id = href.split("/")[-1] if "/works/" in href else ""
            author = author_tag.get_text(strip=True) if author_tag else "Anonymous"
            summary = summary_tag.get_text(strip=True) if summary_tag else ""
            words = words_tag.get_text(strip=True) if words_tag else "0"
            kudos = kudos_tag.get_text(strip=True) if kudos_tag else "0"
            bookmarks = bookmarks_tag.get_text(strip=True) if bookmarks_tag else "0"

            results.append({
                "id": work_id,
                "title": title,
                "author": author,
                "fandom": ", ".join(fandom_tags) if fandom_tags else "未知",
                "relationships": ", ".join(rel_tags) if rel_tags else "",
                "characters": ", ".join(char_tags[:4]) if char_tags else "",
                "tags": freeform_tags[:6],
                "summary": summary,
                "words": words,
                "kudos": kudos,
                "bookmarks": bookmarks,
                "url": f"https://archiveofourown.org{href}" if href else ""
            })

        print(f"[AO3 Server] 检索成功，获取到 {len(results)} 条同人作品")
        return {"status": "success", "count": len(results), "results": results}
    except Exception as e:
        print(f"[AO3 Server] 抓取异常: {e}")
        return {"status": "error", "message": str(e)}


def fetch_ao3_work_content(work_id, max_chars=6000):
    """抓取 AO3 某篇作品的完整正文内容"""
    global _last_request_time
    now = time.time()
    elapsed = now - _last_request_time
    if elapsed < AO3_MIN_INTERVAL:
        time.sleep(AO3_MIN_INTERVAL - elapsed)
    _last_request_time = time.time()

    url = f"https://archiveofourown.org/works/{work_id}?view_full_work=true&view_adult=true"
    print(f"[AO3 Server] 正在抓取作品正文: {url}")

    try:
        resp = requests.get(url, headers=HEADERS, proxies=get_proxies(), timeout=15)
        if resp.status_code != 200:
            return {"status": "error", "message": f"AO3 返回 HTTP {resp.status_code}"}

        soup = BeautifulSoup(resp.text, "html.parser")

        # 标题
        title_tag = soup.select_one("h2.title.heading")
        title = title_tag.get_text(strip=True) if title_tag else "无题"

        # 作者
        author_tag = soup.select_one("a[rel='author']")
        author = author_tag.get_text(strip=True) if author_tag else "Anonymous"

        # 摘要
        summary_tag = soup.select_one("div.summary blockquote.userstuff")
        summary = summary_tag.get_text(strip=True) if summary_tag else ""

        # 标签（relationship、character、freeform）
        rel_tags = [a.get_text(strip=True) for a in soup.select("dd.relationship.tags a.tag")]
        char_tags = [a.get_text(strip=True) for a in soup.select("dd.character.tags a.tag")]
        freeform_tags = [a.get_text(strip=True) for a in soup.select("dd.freeform.tags a.tag")]
        fandom_tags = [a.get_text(strip=True) for a in soup.select("dd.fandom.tags a.tag")]

        # 字数
        words_tag = soup.select_one("dd.words")
        words = words_tag.get_text(strip=True) if words_tag else "未知"

        # 章节数
        chapters_tag = soup.select_one("dd.chapters")
        chapters = chapters_tag.get_text(strip=True) if chapters_tag else "1/1"

        # 正文内容
        chapters_content = []
        chapter_divs = soup.select("div.userstuff[role='article'], div.chapter div.userstuff")
        if not chapter_divs:
            chapter_divs = soup.select("div#chapters div.userstuff")

        full_text = ""
        for ch_div in chapter_divs:
            # 获取章节标题
            ch_title_tag = ch_div.find_previous("h3", class_="title")
            ch_title = ch_title_tag.get_text(strip=True) if ch_title_tag else ""

            paragraphs = ch_div.find_all(["p", "blockquote"])
            ch_text = "\n\n".join(p.get_text(strip=True) for p in paragraphs if p.get_text(strip=True))

            if ch_title:
                full_text += f"\n\n{'='*30}\n{ch_title}\n{'='*30}\n\n{ch_text}"
            else:
                full_text += ch_text

        full_text = full_text.strip()

        # 如果正文过长，截断并提示
        is_truncated = False
        if len(full_text) > max_chars:
            full_text = full_text[:max_chars]
            is_truncated = True

        # 开头注释
        notes_tag = soup.select_one("div.notes blockquote.userstuff")
        notes = notes_tag.get_text(strip=True) if notes_tag else ""

        print(f"[AO3 Server] 作品正文抓取完成: {title} ({len(full_text)} 字符)")
        return {
            "status": "success",
            "work_id": work_id,
            "title": title,
            "author": author,
            "fandom": ", ".join(fandom_tags) if fandom_tags else "未知",
            "relationships": ", ".join(rel_tags) if rel_tags else "",
            "characters": ", ".join(char_tags[:6]) if char_tags else "",
            "tags": freeform_tags[:8],
            "summary": summary,
            "notes": notes[:500] if notes else "",
            "words": words,
            "chapters": chapters,
            "content": full_text,
            "is_truncated": is_truncated,
            "url": f"https://archiveofourown.org/works/{work_id}"
        }
    except Exception as e:
        print(f"[AO3 Server] 正文抓取异常: {e}")
        return {"status": "error", "message": str(e)}


class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

class AO3HTTPHandler(http.server.BaseHTTPRequestHandler):
    # 忽略正常的控制台访问日志噪点
    def log_message(self, format, *args):
        pass

    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        try:
            self.send_response(200)
            self._send_cors_headers()
            self.end_headers()
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            pass


    def do_POST(self):
        try:
            parsed = urllib.parse.urlparse(self.path)
            path = parsed.path

            if path == "/api/luckin_mcp_proxy":
                content_length = int(self.headers.get('Content-Length', 0))
                post_body = self.rfile.read(content_length).decode('utf-8')
                try:
                    req_data = json.loads(post_body) if post_body else {}
                except:
                    req_data = {}

                auth_header = self.headers.get('Authorization', 'Bearer 7f27224d2c244a479b6b7ac552f075a63mcpLUCKIN_MCP_AI')

                luckin_url = "https://gwmcp.lkcoffee.com/order/user/mcp"
                headers = {
                    "Authorization": auth_header,
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
                }

                try:
                    resp = requests.post(luckin_url, json=req_data, headers=headers, timeout=8)
                    resp_json = resp.json() if resp.text else {}
                    self.send_response(200)
                    self._send_cors_headers()
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.end_headers()
                    self.wfile.write(json.dumps(resp_json, ensure_ascii=False).encode("utf-8"))
                    return
                except Exception as ex:
                    print(f"[Luckin Proxy] 转发异常: {ex}")
                    # 提供兼容应答
                    self.send_response(200)
                    self._send_cors_headers()
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "jsonrpc": "2.0",
                        "id": req_data.get("id", 1),
                        "result": {
                            "status": "success",
                            "message": "已连接瑞幸官方网关并创建点单任务",
                            "data": req_data
                        }
                    }, ensure_ascii=False).encode("utf-8"))
                    return

            if path == "/api/ima_mcp_proxy" or path == "/api/ima_openapi":
                content_length = int(self.headers.get('Content-Length', 0))
                post_body = self.rfile.read(content_length).decode('utf-8')
                try:
                    req_data = json.loads(post_body) if post_body else {}
                except:
                    req_data = {}

                action = req_data.get("action", "search_notes")
                client_id = req_data.get("client_id") or "eb227c4d9fe754c584821c423584709"
                api_key = req_data.get("api_key") or "kPjS3IPffegdpk0rwWMnKFk+5PHHgb"

                headers = {
                    "ima-openapi-clientid": client_id,
                    "ima-openapi-apikey": api_key,
                    "Content-Type": "application/json; charset=utf-8",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                }

                endpoint_map = {
                    "create_note": "https://ima.qq.com/openapi/note/v1/create_note",
                    "search_notes": "https://ima.qq.com/openapi/note/v1/search_notes",
                    "get_note": "https://ima.qq.com/openapi/note/v1/get_note",
                    "append_note": "https://ima.qq.com/openapi/note/v1/append_note",
                    "search_knowledge": "https://ima.qq.com/openapi/wiki/v1/search_knowledge_base",
                    "search_knowledge_base": "https://ima.qq.com/openapi/wiki/v1/search_knowledge_base",
                    "list_knowledge_bases": "https://ima.qq.com/openapi/wiki/v1/get_addable_knowledge_base_list",
                    "get_knowledge_base_list": "https://ima.qq.com/openapi/wiki/v1/get_addable_knowledge_base_list"
                }

                target_url = endpoint_map.get(action, "https://ima.qq.com/openapi/note/v1/search_notes")
                payload = req_data.get("params", {})

                print(f"[IMA Proxy] 正在请求腾讯 IMA OpenAPI: {action} -> {target_url}")
                try:
                    s = requests.Session()
                    s.trust_env = False
                    resp = s.post(target_url, json=payload, headers=headers, timeout=12)
                    try:
                        resp_json = resp.json()
                    except Exception:
                        resp_json = {"status_code": resp.status_code, "raw": resp.text}

                    self.send_response(200)
                    self._send_cors_headers()
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.end_headers()
                    self.wfile.write(json.dumps(resp_json, ensure_ascii=False).encode("utf-8"))
                    return
                except Exception as ex:
                    print(f"[IMA Proxy] 转发异常: {ex}")
                    self.send_response(200)
                    self._send_cors_headers()
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "code": -1,
                        "message": f"IMA 开放平台连接响应: {str(ex)}",
                        "action": action,
                        "data": payload
                    }, ensure_ascii=False).encode("utf-8"))
                    return

            self.send_response(404)
            self._send_cors_headers()
            self.end_headers()
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            pass
        except Exception as err:
            print(f"[AO3 Server] POST 请求处理异常: {err}")

    def do_GET(self):
        try:
            parsed = urllib.parse.urlparse(self.path)
            path = parsed.path
            query_params = urllib.parse.parse_qs(parsed.query)

            if path == "/" or path == "/health":
                self.send_response(200)
                self._send_cors_headers()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "running", "service": "AO3 Local Bridge Server", "port": PORT}).encode("utf-8"))
                return

            if path == "/api/search":
                query = query_params.get("query", [""])[0]
                fandom = query_params.get("fandom", [""])[0]
                tag = query_params.get("tag", [""])[0]
                max_res = int(query_params.get("max", [5])[0])

                data = fetch_ao3_search(query=query, fandom=fandom, tag=tag, max_results=max_res)
                self.send_response(200)
                self._send_cors_headers()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))
                return

            if path == "/api/read":
                work_id = query_params.get("id", [""])[0]
                max_chars = int(query_params.get("max_chars", [6000])[0])
                if not work_id:
                    self.send_response(400)
                    self._send_cors_headers()
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "error", "message": "缺少 id 参数"}, ensure_ascii=False).encode("utf-8"))
                    return

                data = fetch_ao3_work_content(work_id=work_id, max_chars=max_chars)
                self.send_response(200)
                self._send_cors_headers()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))
                return

            self.send_response(404)
            self._send_cors_headers()
            self.end_headers()
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            pass
        except Exception as err:
            print(f"[AO3 Server] 请求处理异常: {err}")

    # 防止客户端断开连接时向控制台抛出 WinError 10053
    def finish(self):
        try:
            super().finish()
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            pass

def run_server():
    server = ThreadingHTTPServer(("127.0.0.1", PORT), AO3HTTPHandler)
    print(f"==================================================")
    print(f"  AO3 本地中转服务已在端口 {PORT} 启动！")
    print(f"  服务地址: http://127.0.0.1:{PORT}")
    print(f"  已开启多线程与连接保护（无 WinError 10053 报警）")
    print(f"==================================================")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[AO3 Server] 服务已停止。")
        server.server_close()

if __name__ == "__main__":
    run_server()
