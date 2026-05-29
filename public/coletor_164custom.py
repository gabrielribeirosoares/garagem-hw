#!/usr/bin/env python3
import argparse
import json
import logging
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

try:
    from apscheduler.schedulers.blocking import BlockingScheduler
    from apscheduler.triggers.cron import CronTrigger
except Exception:
    BlockingScheduler = None
    CronTrigger = None

BASE_URL = "https://164custom.com"
INDEX_URL = "https://164custom.com/hot-wheels-mainline-case-highlights_HW.html"
USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
DEFAULT_STATE_FILE = Path("state/hot_wheels_state.json")
DEFAULT_OUTPUT_FILE = Path("state/latest_snapshot.json")
VALID_CASES = {"A","B","C","D","E","F","G","H","J","K","L","M","N","P","Q"}

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("hw_watcher")


@dataclass
class Car:
    year: int
    part: str
    name: str
    series: str
    color: str
    cas: str
    image: str

    def to_dict(self) -> dict:
        return {
            "year": self.year,
            "part": self.part,
            "name": self.name,
            "series": self.series,
            "color": self.color,
            "cas": self.cas,
            "image": self.image,
        }


def session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT})
    return s


def get_soup(s: requests.Session, url: str) -> BeautifulSoup:
    r = s.get(url, timeout=30)
    r.raise_for_status()
    return BeautifulSoup(r.text, "html.parser")


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def normalize_header(text: str) -> str:
    t = clean(text).lower()
    t = t.replace("#", " #")
    t = re.sub(r"\s+", " ", t).strip()
    return t


def find_case_links(s: requests.Session, year: int) -> Dict[str, str]:
    soup = get_soup(s, INDEX_URL)
    links: Dict[str, str] = {}

    for a in soup.find_all("a", href=True):
        text = clean(a.get_text(" ", strip=True))
        href = a["href"]
        m = re.search(rf"{year}\s+Hot Wheels Case\s+([A-Z])", text, re.I)
        if not m:
            m = re.search(rf"{year}\s+([A-Z])\s+case", text, re.I)
        if not m:
            href_match = re.search(r"/case-([a-z])/([0-9]+)\.html$", href, re.I)
            if href_match:
                case_letter = href_match.group(1).upper()
                year_in_href = href_match.group(2)
                if year_in_href == str(year):
                    links[case_letter] = urljoin(INDEX_URL, href)
                    continue
            continue
        else:
            case_letter = m.group(1).upper()

        if case_letter in VALID_CASES:
            links[case_letter] = urljoin(INDEX_URL, href)

    return dict(sorted(links.items()))


def parse_case_page(s: requests.Session, url: str, fallback_year: int, fallback_case: str = "") -> List[Car]:
    soup = get_soup(s, url)
    cars: List[Car] = []

    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if len(rows) < 2:
            continue

        for row in rows[1:]:
            cells = row.find_all(["td", "th"])
            if len(cells) < 10:
                continue

            values = [clean(c.get_text(" ", strip=True)) for c in cells]
            year_str = values[0] if len(values) > 0 else str(fallback_year)
            name = values[2] if len(values) > 2 else ""
            part = values[5] if len(values) > 5 else "N/A"
            series = values[7] if len(values) > 7 else ""
            case_letter = values[9] if len(values) > 9 else fallback_case

            if not name:
                continue

            year = int(year_str) if str(year_str).isdigit() else fallback_year
            part = part or "N/A"
            case_letter = case_letter.upper().strip() if case_letter else fallback_case

            cars.append(Car(
                year=year,
                part=part,
                name=name,
                series=series,
                color="",
                cas=case_letter,
                image="",
            ))

    unique = {}
    for car in cars:
        unique[make_key(car.to_dict())] = car
    return list(unique.values())


def scrape_year(year: int) -> List[dict]:
    s = session()
    case_links = find_case_links(s, year)
    logger.info("Cases encontrados para %s: %s", year, ", ".join(case_links.keys()) or "nenhum")
    all_cars: List[dict] = []

    for case_letter, case_url in case_links.items():
        logger.info("Raspando case %s -> %s", case_letter, case_url)
        items = parse_case_page(s, case_url, year, fallback_case=case_letter)
        for item in items:
            if not item.cas:
                item.cas = case_letter
            all_cars.append(item.to_dict())

    dedup = {}
    for item in all_cars:
        dedup[make_key(item)] = item
    return sorted(dedup.values(), key=lambda x: (x["cas"], x["name"], x["part"]))


def make_key(item: dict) -> str:
    return "|".join([
        str(item.get("year", "")),
        clean(item.get("cas", "")).upper(),
        clean(item.get("name", "")).lower(),
        clean(item.get("part", "")).upper(),
    ])


def load_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def diff_items(old_items: List[dict], new_items: List[dict]) -> List[dict]:
    old_keys = {make_key(x) for x in old_items}
    return [x for x in new_items if make_key(x) not in old_keys]


def format_whatsapp_text(year: int, new_items: List[dict]) -> str:
    cases = sorted({x.get("cas", "") for x in new_items if x.get("cas")})
    lines = [f"Novidades Hot Wheels {year}: {len(new_items)} item(ns) novo(s)."]
    if cases:
        lines.append("Cases novos/alterados: " + ", ".join(cases))
    for item in new_items[:20]:
        series_info = f" | {item['series']}" if item.get("series") else ""
        lines.append(f"- {item['cas']} | {item['name']}{series_info} | {item['part']}")
    if len(new_items) > 20:
        lines.append(f"... e mais {len(new_items) - 20} item(ns)")
    return "\n".join(lines)


def send_whatsapp_text(message: str, to_number: Optional[str] = None) -> dict:
    phone_number_id = os.environ["WA_PHONE_NUMBER_ID"]
    token = os.environ["WA_TOKEN"]
    api_version = os.environ.get("WA_API_VERSION", "v20.0")
    to_number = to_number or os.environ["WA_TO"]

    url = f"https://graph.facebook.com/{api_version}/{phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to_number,
        "type": "text",
        "text": {"body": message},
    }
    resp = requests.post(url, headers=headers, json=payload, timeout=30)
    resp.raise_for_status()
    return resp.json()


def run_once(year: int, state_file: Path, output_file: Path, notify: bool) -> dict:
    previous_state = load_json(state_file, {"items": [], "last_run": None, "last_alert_keys": []})
    old_items = previous_state.get("items", [])

    new_items = scrape_year(year)
    novidades = diff_items(old_items, new_items)
    now = datetime.now(timezone.utc).isoformat()

    result = {
        "year": year,
        "timestamp": now,
        "total_items": len(new_items),
        "new_items_count": len(novidades),
        "new_cases": sorted({x.get("cas", "") for x in novidades if x.get("cas")}),
        "new_items": novidades,
    }

    save_json(output_file, result)

    state_payload = {
        "last_run": now,
        "items": new_items,
        "last_alert_keys": [make_key(x) for x in novidades],
    }
    save_json(state_file, state_payload)

    if notify and novidades:
        message = format_whatsapp_text(year, novidades)
        wa_resp = send_whatsapp_text(message)
        result["whatsapp"] = wa_resp
        save_json(output_file, result)
        logger.info("WhatsApp enviado com %s novidades.", len(novidades))
    elif notify:
        logger.info("Nenhuma novidade; WhatsApp não enviado.")

    return result


def scheduler_loop(year: int, cron_expr: str, state_file: Path, output_file: Path, notify: bool, timezone_name: str):
    if BlockingScheduler is None or CronTrigger is None:
        raise RuntimeError("APScheduler não instalado. Rode: pip install apscheduler")

    parts = cron_expr.split()
    if len(parts) != 5:
        raise ValueError("CRON deve ter 5 campos: minuto hora dia mês dia_da_semana")

    minute, hour, day, month, day_of_week = parts
    sched = BlockingScheduler(timezone=timezone_name)
    trigger = CronTrigger(minute=minute, hour=hour, day=day, month=month, day_of_week=day_of_week, timezone=timezone_name)
    sched.add_job(run_once, trigger=trigger, args=[year, state_file, output_file, notify], id="hw-watch", replace_existing=True)
    logger.info("Agendado com cron '%s' no fuso %s", cron_expr, timezone_name)
    sched.start()


def parse_args():
    p = argparse.ArgumentParser(description="Raspa cases do 164custom, compara snapshot e notifica no WhatsApp.")
    p.add_argument("--year", type=int, default=datetime.now().year)
    p.add_argument("--state-file", type=Path, default=DEFAULT_STATE_FILE)
    p.add_argument("--output-file", type=Path, default=DEFAULT_OUTPUT_FILE)
    p.add_argument("--notify", action="store_true")
    p.add_argument("--schedule", action="store_true", help="Liga o agendamento com APScheduler")
    p.add_argument("--cron", default="0 */6 * * *", help="Expressao cron de 5 campos: min hora dia mes dia_semana")
    p.add_argument("--timezone", default="America/Sao_Paulo")
    return p.parse_args()


def main():
    args = parse_args()
    if args.schedule:
        scheduler_loop(args.year, args.cron, args.state_file, args.output_file, args.notify, args.timezone)
    else:
        result = run_once(args.year, args.state_file, args.output_file, args.notify)
        logger.info("Finalizado. Total=%s Novos=%s Cases=%s", result["total_items"], result["new_items_count"], ", ".join(result["new_cases"]))


if __name__ == "__main__":
    main()