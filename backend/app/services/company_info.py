"""Service to fetch company information using web search."""

import json
import urllib.parse
import urllib.request
from typing import Any

from app.config import get_settings
from app.services.helpers import is_real_secret


def fetch_company_info(company_name: str, company_website: str | None = None) -> str:
    """
    Fetch company information using Brave Search API.
    
    Returns a brief summary of the company.
    """
    settings = get_settings()

    if not is_real_secret(settings.brave_api_key):
        return ""

    try:
        # Search for company information; prefer targeted query when website is supplied.
        website = (company_website or "").strip()
        if website:
            website = website.replace("https://", "").replace("http://", "").strip("/")
            search_query = f"site:{website} about mission values culture {company_name}"
        else:
            search_query = f"{company_name} company overview about mission"
        params = {"q": search_query, "count": 3}
        headers = {
            "X-Subscription-Token": settings.brave_api_key,
            "Accept": "application/json",
        }

        url = f"https://api.search.brave.com/res/v1/web/search?{urllib.parse.urlencode(params)}"
        request = urllib.request.Request(url=url, headers=headers, method="GET")

        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read().decode("utf-8")
            data = json.loads(body)

            # Combine relevant descriptions from top results
            descriptions = []
            for result in data.get("web", [])[:2]:
                desc = result.get("description", "")
                if desc and len(desc) > 50:
                    descriptions.append(desc)

            if descriptions:
                return " ".join(descriptions)[:500]

    except Exception:
        pass

    return ""
