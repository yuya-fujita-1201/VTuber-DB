import html as html_lib
import json
import re
import time

import requests

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "VTuber-DB-Collector/1.0 (+https://github.com/yuya-fujita-1201/VTuber-DB)"
})

WIKI_API = "https://virtualyoutuber.fandom.com/api.php"


def fetch_text(url, params=None):
    last_error = None
    for attempt in range(3):
        try:
            resp = SESSION.get(url, params=params, timeout=20)
            resp.raise_for_status()
            return resp.text
        except requests.RequestException as exc:
            last_error = exc
            time.sleep(1 + attempt)
    raise last_error


def fetch_json(url, params=None):
    last_error = None
    for attempt in range(3):
        try:
            resp = SESSION.get(url, params=params, timeout=20)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            last_error = exc
            time.sleep(1 + attempt)
    raise last_error


def strip_tags(text):
    return re.sub(r"<[^>]+>", "", text).strip()


def extract_youtube_urls(text):
    urls = re.findall(r"https?://(?:www\.)?youtube\.com/[^\s\]|}<>\"]+", text)
    urls += re.findall(r"https?://youtu\.be/[^\s\]|}<>\"]+", text)
    return urls


def normalize_youtube_url(url):
    if not url:
        return None
    url = url.rstrip(').,')
    if '?' in url:
        url = url.split('?', 1)[0]
    return url


def extract_channel_id_from_url(url):
    if not url:
        return None
    m = re.search(r"youtube\.com/channel/(UC[\w-]+)", url)
    if m:
        return m.group(1)
    return None


def resolve_channel_id(url, cache):
    url = normalize_youtube_url(url)
    channel_id = extract_channel_id_from_url(url)
    if channel_id:
        return channel_id, f"https://www.youtube.com/channel/{channel_id}"

    if not url:
        return None, None

    if url in cache:
        cached = cache[url]
        return cached, f"https://www.youtube.com/channel/{cached}" if cached else None

    try:
        html = fetch_text(url)
    except Exception:
        cache[url] = None
        return None, url

    patterns = [
        r"\"channelId\":\"(UC[\w-]+)\"",
        r"itemprop=\"channelId\" content=\"(UC[\w-]+)\"",
        r"\"externalId\":\"(UC[\w-]+)\"",
    ]
    channel_id = None
    for pat in patterns:
        m = re.search(pat, html)
        if m:
            channel_id = m.group(1)
            break

    cache[url] = channel_id
    if channel_id:
        return channel_id, f"https://www.youtube.com/channel/{channel_id}"
    return None, url


def extract_hololive_talent_urls(html):
    urls = set(
        re.findall(
            r"https://hololive\.hololivepro\.com/(?:en/|id/)?talents/[a-z0-9-]+/",
            html,
        )
    )
    normalized = set()
    for url in urls:
        m = re.search(r"/talents/([a-z0-9-]+)/", url)
        if m:
            normalized.add(f"https://hololive.hololivepro.com/talents/{m.group(1)}/")
    return sorted(normalized)


def extract_holostars_talent_urls(html):
    urls = set(re.findall(r"https://holostars\.hololivepro\.com/talent/[a-z0-9-]+/", html))
    return sorted(urls)


def extract_hololive_unit(html):
    for label in ["ユニット", "Unit"]:
        m = re.search(rf"<dt>{label}</dt>\s*<dd>(.*?)</dd>", html, re.S)
        if m:
            return strip_tags(m.group(1))
    return None


def extract_hololive_name(html):
    m = re.search(r'<meta property="og:title" content="([^"]+)"', html)
    if not m:
        return None
    title = m.group(1)
    return title.split(" | ", 1)[0].strip()


def extract_primary_channel_url(html):
    m = re.search(r"https?://www\.youtube\.com/[^\"\s>]*sub_confirmation=1", html)
    if m:
        return normalize_youtube_url(m.group(0))

    for pat in [
        r'https?://www\.youtube\.com/channel/[^"\s>]+',
        r'https?://www\.youtube\.com/@[^"\s>]+',
        r'https?://www\.youtube\.com/c/[^"\s>]+',
        r'https?://www\.youtube\.com/user/[^"\s>]+',
    ]:
        m = re.search(pat, html)
        if m:
            return normalize_youtube_url(m.group(0))

    return None


def map_hololive_division(unit):
    if not unit:
        return None
    unit_lower = unit.lower()
    if "スタッフ" in unit or "holoan" in unit_lower:
        return None
    if any(token in unit_lower for token in ["holostars", "uproar", "tempus", "armis"]):
        return "holostars"
    if "ホロスターズ" in unit:
        return "holostars"
    if any(token in unit_lower for token in ["hololive english", "myth", "promise", "council", "advent", "justice", "project: hope"]):
        return "hololive-en"
    if "english" in unit_lower:
        return "hololive-en"
    if any(token in unit_lower for token in ["hololive indonesia", "indonesia", "area 15", "holoro"]):
        return "hololive-id"
    if "インドネシア" in unit:
        return "hololive-id"
    return "hololive-jp"


def collect_hololive():
    channel_cache = {}
    html = fetch_text("https://hololive.hololivepro.com/talents")
    talent_urls = extract_hololive_talent_urls(html)

    divisions = {
        "hololive-jp": {"name": "ホロライブJP", "name_en": "hololive-jp", "channels": []},
        "hololive-en": {"name": "ホロライブEN", "name_en": "hololive-en", "channels": []},
        "hololive-id": {"name": "ホロライブID", "name_en": "hololive-id", "channels": []},
        "holostars": {"name": "ホロスターズ", "name_en": "holostars", "channels": []},
    }

    for url in talent_urls:
        page = fetch_text(url)
        name = extract_hololive_name(page)
        unit = extract_hololive_unit(page)
        division_key = map_hololive_division(unit)
        if not division_key:
            continue
        channel_url = extract_primary_channel_url(page)
        channel_id, canonical_url = resolve_channel_id(channel_url, channel_cache)
        if not name or not channel_id:
            continue
        divisions[division_key]["channels"].append({
            "name": name,
            "channel_id": channel_id,
            "channel_url": canonical_url or channel_url,
        })
        time.sleep(0.05)

    holostars_html = fetch_text("https://holostars.hololivepro.com/talent")
    holostars_urls = extract_holostars_talent_urls(holostars_html)
    for url in holostars_urls:
        page = fetch_text(url)
        name = extract_hololive_name(page)
        channel_url = extract_primary_channel_url(page)
        channel_id, canonical_url = resolve_channel_id(channel_url, channel_cache)
        if not name or not channel_id:
            continue
        divisions["holostars"]["channels"].append({
            "name": name,
            "channel_id": channel_id,
            "channel_url": canonical_url or channel_url,
        })
        time.sleep(0.05)

    return {
        "name": "ホロライブ",
        "name_en": "hololive",
        "divisions": list(divisions.values()),
    }


def extract_build_id(html):
    m = re.search(r'"buildId"\s*:\s*"([^"]+)"', html)
    return m.group(1) if m else None


def collect_nijisanji():
    talents_html = fetch_text("https://www.nijisanji.jp/talents")
    build_id = extract_build_id(talents_html)
    if not build_id:
        raise RuntimeError("Failed to find Nijisanji buildId")

    data = fetch_json(f"https://www.nijisanji.jp/_next/data/{build_id}/ja/talents.json")
    all_livers = data["pageProps"]["allLivers"]

    divisions = {
        "nijisanji-jp": {"name": "にじさんじJP", "name_en": "nijisanji-jp", "channels": []},
        "nijisanji-en": {"name": "にじさんじEN", "name_en": "nijisanji-en", "channels": []},
        "nijisanji-id": {"name": "にじさんじID", "name_en": "nijisanji-id", "channels": []},
        "nijisanji-kr": {"name": "にじさんじKR", "name_en": "nijisanji-kr", "channels": []},
        "virtua-real": {"name": "VirtuaReal", "name_en": "virtua-real", "channels": []},
    }

    for liver in all_livers:
        slug = liver.get("slug")
        if not slug:
            continue
        detail = fetch_json(f"https://www.nijisanji.jp/_next/data/{build_id}/ja/talents/l/{slug}.json")
        info = detail["pageProps"]["liverDetail"]
        name = info.get("name") or liver.get("name")
        channel_id = info.get("channelId")
        channel_url = None
        social = info.get("socialLinks") or {}
        if social.get("youtube"):
            channel_url = social.get("youtube")
        elif channel_id:
            channel_url = f"https://www.youtube.com/channel/{channel_id}"

        affiliation = (info.get("profile") or {}).get("affiliation")
        if isinstance(affiliation, list) and affiliation:
            affiliation = affiliation[0]

        if affiliation == "NIJISANJI EN":
            division_key = "nijisanji-en"
        elif affiliation == "VirtuaReal":
            division_key = "virtua-real"
        else:
            division_key = "nijisanji-jp"

        if not name or not channel_id or not channel_url:
            continue

        divisions[division_key]["channels"].append({
            "name": name,
            "channel_id": channel_id,
            "channel_url": channel_url,
        })
        time.sleep(0.03)

    return {
        "name": "にじさんじ",
        "name_en": "nijisanji",
        "divisions": list(divisions.values()),
    }


def extract_member_names_from_html(html):
    selected_sections = []

    h2_headings = list(re.finditer(
        r'<h2[^>]*>\s*<span class="mw-headline" id="([^"]+)">([^<]+)</span>.*?</h2>',
        html,
        re.I | re.S,
    ))
    for i, match in enumerate(h2_headings):
        title = html_lib.unescape(match.group(2)).strip()
        title_lower = title.lower()
        if any(token in title_lower for token in ["members", "member", "talent", "livers", "roster"]):
            if any(token in title_lower for token in ["former", "graduated", "alumni", "ex-"]):
                continue
            start = match.end()
            end = h2_headings[i + 1].start() if i + 1 < len(h2_headings) else len(html)
            selected_sections.append(html[start:end])

    if not selected_sections:
        headings = list(re.finditer(
            r'<h[2-4][^>]*>\s*<span class="mw-headline" id="([^"]+)">([^<]+)</span>.*?</h[2-4]>',
            html,
            re.I | re.S,
        ))
        for i, match in enumerate(headings):
            title = html_lib.unescape(match.group(2)).strip()
            title_lower = title.lower()
            if any(token in title_lower for token in ["members", "member", "talent", "livers", "roster"]):
                if any(token in title_lower for token in ["former", "graduated", "alumni", "ex-"]):
                    continue
                start = match.end()
                end = headings[i + 1].start() if i + 1 < len(headings) else len(html)
                selected_sections.append(html[start:end])

    if not selected_sections:
        return []

    combined = "\n".join(selected_sections)
    links = re.findall(r'<a[^>]+href="/wiki/([^"]+)"', combined)
    members = []
    for link in links:
        title = html_lib.unescape(link.split("#", 1)[0])
        name = title.replace("_", " ").strip()
        if not name or ":" in name:
            continue
        if name.startswith("List of"):
            continue
        members.append(name)
    return sorted(set(members))


def extract_youtube_from_wikitext(text):
    head = "\n".join(text.splitlines()[:200])
    urls = extract_youtube_urls(head)
    for url in urls:
        if "watch" in url or "embed" in url or "youtu.be/" in url:
            continue
        if any(token in url for token in ["/channel/", "/@", "/c/", "/user/"]):
            return normalize_youtube_url(url)

    m = re.search(r"\{\{\s*YouTube\s*\|([^}]+)\}\}", head, re.I)
    if m:
        params = m.group(1).split("|")
        for param in params:
            param = param.strip()
            if param.startswith("channel="):
                channel_id = param.split("=", 1)[1].strip()
                if channel_id.startswith("UC"):
                    return f"https://www.youtube.com/channel/{channel_id}"
            if param.startswith("id="):
                channel_id = param.split("=", 1)[1].strip()
                if channel_id.startswith("UC"):
                    return f"https://www.youtube.com/channel/{channel_id}"
            if param.startswith("UC"):
                return f"https://www.youtube.com/channel/{param}"

    return None


def collect_other_agency(agency, channel_cache, seen_ids):
    html = fetch_json(WIKI_API, params={
        "action": "parse",
        "page": agency["wiki_page"],
        "prop": "text",
        "format": "json",
    }).get("parse", {}).get("text", {}).get("*", "")

    if not html:
        return {
            "name": agency["name"],
            "name_en": agency["name_en"],
            "channels": [],
        }

    members = extract_member_names_from_html(html)
    channels = []

    for member in members:
        page = fetch_json(WIKI_API, params={
            "action": "parse",
            "page": member,
            "prop": "wikitext",
            "format": "json",
        })
        text = page.get("parse", {}).get("wikitext", {}).get("*", "")
        if not text:
            continue
        channel_url = extract_youtube_from_wikitext(text)
        if not channel_url:
            continue
        channel_id, canonical_url = resolve_channel_id(channel_url, channel_cache)
        if channel_id and channel_id in seen_ids:
            continue
        if not channel_id:
            continue

        channels.append({
            "name": member,
            "channel_id": channel_id,
            "channel_url": canonical_url or channel_url,
        })
        seen_ids.add(channel_id)
        time.sleep(0.05)

    return {
        "name": agency["name"],
        "name_en": agency["name_en"],
        "channels": channels,
    }


def collect_other_agencies():
    other_agencies = [
        {"name": "ぶいすぽっ!", "name_en": "vspo", "wiki_page": "VSPO!"},
        {"name": "Re:AcT", "name_en": "react", "wiki_page": "Re:AcT"},
        {"name": "Neo-Porte", "name_en": "neo-porte", "wiki_page": "Neo-Porte"},
        {"name": ".LIVE", "name_en": "dotlive", "wiki_page": ".LIVE"},
        {"name": "PRISM Project", "name_en": "prism-project", "wiki_page": "PRISM Project"},
        {"name": "Phase-Connect", "name_en": "phase-connect", "wiki_page": "Phase-Connect"},
        {"name": "ななしいんく", "name_en": "nanashiinku", "wiki_page": "Nanashiinku"},
        {"name": "VShojo", "name_en": "vshojo", "wiki_page": "VShojo"},
    ]

    channel_cache = {}
    seen_ids = set()
    agencies = []
    for agency in other_agencies:
        agencies.append(collect_other_agency(agency, channel_cache, seen_ids))
    return agencies


def main():
    agencies = []
    agencies.append(collect_hololive())
    agencies.append(collect_nijisanji())
    agencies.extend(collect_other_agencies())

    data = {"agencies": agencies}

    with open("data/vtuber_agencies_full.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print("Saved data/vtuber_agencies_full.json")


if __name__ == "__main__":
    main()
