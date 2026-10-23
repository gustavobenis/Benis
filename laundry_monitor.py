#!/usr/bin/env python3
"""Avisa quando uma lavadora/secadora da lavanderia muda de estado.

Variáveis de ambiente:
  MG_TOKEN    token Bearer da sua sessão (dura ~2h; cole um novo quando expirar)
  MG_URL      URL completa da requisição available-machines (copiada do DevTools)
  NTFY_TOPIC  tópico do ntfy.sh para receber o aviso no celular (opcional)
  MG_INTERVAL segundos entre consultas (padrão 90)
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

TOKEN = os.environ.get("MG_TOKEN", "")
URL = os.environ.get("MG_URL", "")
NTFY_TOPIC = os.environ.get("NTFY_TOPIC", "")
INTERVAL = max(60, int(os.environ.get("MG_INTERVAL", "90")))


def notify(text):
    print(time.strftime("%H:%M:%S"), text, flush=True)
    if NTFY_TOPIC:
        req = urllib.request.Request(
            f"https://ntfy.sh/{NTFY_TOPIC}", data=text.encode(), method="POST"
        )
        try:
            urllib.request.urlopen(req, timeout=10)
        except urllib.error.URLError as e:
            print("falha ao notificar:", e, file=sys.stderr)


def current_url():
    """Troca o startTime copiado do DevTools pelo horário atual."""
    parts = urllib.parse.urlsplit(URL)
    query = urllib.parse.parse_qs(parts.query, keep_blank_values=True)
    if "startTime" in query:
        now = datetime.now(timezone.utc)
        query["startTime"] = [now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now.microsecond // 1000:03d}Z"]
    return urllib.parse.urlunsplit(parts._replace(query=urllib.parse.urlencode(query, doseq=True)))


def fetch():
    req = urllib.request.Request(
        current_url(),
        headers={
            "authorization": f"Bearer {TOKEN}",
            "accept": "application/json, text/plain, */*",
            "origin": "https://machine-guardian.com",
            "referer": "https://machine-guardian.com/",
            "x-app-platform": "web",
            "x-app-version": "1.8.0",
        },
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.load(resp)["data"]
    return {m["displayName"]: m["status"] for m in data["washers"] + data["dryers"]}


def main():
    if not TOKEN or not URL:
        sys.exit("Defina MG_TOKEN e MG_URL (veja o topo do arquivo).")
    last = None
    wait = INTERVAL
    while True:
        try:
            current = fetch()
            wait = INTERVAL
            if last is None:
                notify("Monitor iniciado: " + ", ".join(f"{k}={v}" for k, v in current.items()))
            else:
                for name, status in current.items():
                    if last.get(name) != status:
                        notify(f"{name}: {last.get(name)} -> {status}")
            last = current
        except urllib.error.HTTPError as e:
            if e.code == 401:
                notify("Token expirou (401). Gere um novo e reinicie o monitor.")
                sys.exit(1)
            if e.code == 429:
                wait = int(e.headers.get("Retry-After", "300"))
                print(f"limite atingido, aguardando {wait}s", file=sys.stderr)
            else:
                print("erro HTTP", e.code, file=sys.stderr)
        except (urllib.error.URLError, KeyError, ValueError) as e:
            print("erro:", e, file=sys.stderr)
        time.sleep(wait)


if __name__ == "__main__":
    main()
