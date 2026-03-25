"""Service to fetch company information using web search."""

import json
import urllib.parse
import urllib.request
from typing import Any
from html.parser import HTMLParser

from app.config import get_settings
from app.services.helpers import is_real_secret


class TextExtractor(HTMLParser):
    """Extract text from HTML, ignoring scripts/styles."""
    def __init__(self):
        super().__init__()
        self.text = []
        self.skip = False

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.skip = True

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.skip = False

    def handle_data(self, data):
        if not self.skip:
            text = data.strip()
            if text:
                self.text.append(text)

    def get_text(self):
        return ' '.join(self.text)


def fetch_company_info(company_name: str, company_website: str | None = None) -> str:
    """
    Fetch company information from the website or Brave Search.
    Prefers direct website scraping when URL provided.
    
    Returns a brief summary of the company.
    """
    settings = get_settings()

    # If website provided, try to scrape it directly first
    if company_website:
        website = company_website.strip()
        if not website.startswith(('http://', 'https://')):
            website = f"https://{website}"
        
        try:
            headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
            request = urllib.request.Request(website, headers=headers)
            with urllib.request.urlopen(request, timeout=10) as response:
                html = response.read().decode('utf-8', errors='ignore')
                
                # Extract text from HTML
                parser = TextExtractor()
                parser.feed(html)
                content = parser.get_text()
                
                # Get first 500 chars of meaningful content
                if content and len(content) > 50:
                    return content[:1000]
        except Exception:
            # Fall back to Brave Search if website scrape fails
            pass

    # Fallback to Brave Search
    if not is_real_secret(settings.brave_api_key):
        return ""

    try:
        # Brave Search query
        if company_website:
            website_domain = (company_website or "").strip().replace("https://", "").replace("http://", "").strip("/")
            search_query = f"site:{website_domain} about mission values"
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

