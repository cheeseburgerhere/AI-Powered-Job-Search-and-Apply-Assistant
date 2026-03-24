"""Service to scrape job details from a URL."""

import json
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any
from html.parser import HTMLParser

from app.config import get_settings
from app.services.helpers import is_real_secret


class JobDetailsHTMLParser(HTMLParser):
    """Parse HTML to extract job posting details."""
    
    def __init__(self):
        super().__init__()
        self.title_text = ""
        self.meta_description = ""
        self.headings = []
        self.paragraphs = []
        self.in_nav = False
        self.in_footer = False
        self.in_script = False
        self.current_text = []
        self.current_tag = None
        
    def handle_starttag(self, tag, attrs):
        if tag in ['script', 'style']:
            self.in_script = True
            return
        if tag in ['nav', 'footer']:
            self.in_nav = True
            return
        if tag == 'title':
            self.current_tag = 'title'
        elif tag in ['h1', 'h2', 'h3']:
            self.current_tag = tag
        elif tag == 'p':
            self.current_tag = 'p'
        elif tag == 'meta':
            attrs_dict = dict(attrs)
            if attrs_dict.get('name') == 'description' or attrs_dict.get('property') == 'og:description':
                self.meta_description = attrs_dict.get('content', '')
    
    def handle_endtag(self, tag):
        if tag in ['script', 'style']:
            self.in_script = False
            self.current_text = []
            return
        if tag in ['nav', 'footer']:
            self.in_nav = False
            return
            
        text = ' '.join(self.current_text).strip()
        if text and len(text) > 3:
            if self.current_tag == 'title':
                self.title_text = text
            elif self.current_tag in ['h1', 'h2', 'h3']:
                self.headings.append(text)
            elif self.current_tag == 'p' and not self.in_nav:
                self.paragraphs.append(text)
        
        self.current_text = []
        self.current_tag = None
    
    def handle_data(self, data):
        if not self.in_script:
            self.current_text.append(data.strip())


async def fetch_page_html(url: str) -> str:
    """Fetch raw HTML content from a URL."""
    try:
        request = urllib.request.Request(
            url=url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            html = response.read().decode("utf-8", errors="ignore")
            return html
    except Exception as exc:
        raise RuntimeError(f"Failed to fetch page: {exc}") from exc


def _extract_company_from_url(url: str) -> str:
    """Try to extract company name from URL."""
    try:
        parsed = urllib.parse.urlparse(url)
        hostname = parsed.hostname or ""
        # Remove common patterns
        hostname = hostname.replace("www.", "").replace(".com", "").replace(".co", "").split(".")[0]
        if hostname and len(hostname) > 2:
            return hostname.capitalize()
    except Exception:
        pass
    return ""


def _use_brave_search_to_get_page_content(url: str, settings: Any) -> dict[str, Any]:
    """Use Brave Search API to fetch and parse the page content about a job URL."""
    if not is_real_secret(settings.brave_api_key):
        return {}

    try:
        # Search for content about this specific URL
        search_query = url
        params = {"q": search_query, "count": 1}
        headers = {
            "X-Subscription-Token": settings.brave_api_key,
            "Accept": "application/json",
        }

        url_str = f"https://api.search.brave.com/res/v1/web/search?{urllib.parse.urlencode(params)}"
        request = urllib.request.Request(url=url_str, headers=headers, method="GET")

        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read().decode("utf-8")
            data = json.loads(body)
            if data.get("web"):
                result = data["web"][0]
                return {
                    "title": result.get("title", ""),
                    "description": result.get("description", ""),
                    "snippet": result.get("snippet", ""),
                }
    except Exception:
        pass

    return {}


def extract_job_details_from_html(html: str, url: str, brave_result: dict[str, Any]) -> dict[str, Any]:
    """Extract job details from HTML using structured parsing."""
    
    # Parse HTML structure
    parser = JobDetailsHTMLParser()
    try:
        parser.feed(html)
    except Exception:
        pass
    
    # Extract title
    title = "Job Opening"
    
    # Try page title first (usually most accurate)
    if parser.title_text:
        title = parser.title_text.strip()
    
    # Fall back to meta description if it has job keywords
    if (not parser.title_text or len(parser.title_text) < 20) and parser.meta_description:
        if any(word in parser.meta_description.lower() for word in ["job", "position", "role", "hiring"]):
            title = parser.meta_description[:100]
    
    # Use Brave's title if our extraction is weak
    if not parser.title_text and brave_result.get("title"):
        title = brave_result["title"][:100]
    
    # Clean up title (remove excessive pipes, navigation cruft)
    title = re.sub(r'\s*\|\s*.*?(jobs|careers|hiring|company|startup).*', '', title, flags=re.IGNORECASE)
    title = re.sub(r'\s*[-–]\s*(jobs|careers|hiring|company|startup).*', '', title, flags=re.IGNORECASE)
    title = title.strip()[:120]
    
    # Extract company name
    company = "Company"
    
    # Try to find company from headings/title
    if parser.headings:
        # Look for company name in headings
        for heading in parser.headings[:3]:
            if any(word not in heading.lower() for word in ["apply", "job", "position", "role"]):
                # This heading might be company-related
                if "at" in heading.lower():
                    parts = heading.split(" at ")
                    if len(parts) > 1:
                        company = parts[-1].strip()[:50]
                        break
    
    # Extract from URL if still generic
    if company == "Company":
        url_company = _extract_company_from_url(url)
        if url_company:
            company = url_company
    
    # Use Brave's description if available and better
    if brave_result.get("description"):
        brave_desc = brave_result["description"]
        if any(word in brave_desc.lower() for word in ["job", "role", "position", "work", "team"]):
            company = brave_result.get("title", "").split(" at ")[-1][:50] or company
    
    # Extract description
    description = ""
    
    # Use all paragraphs without filtering by length or keywords
    if parser.paragraphs:
        # Combine paragraphs
        description = " ".join(parser.paragraphs)[:600]
    
    # Fall back to Brave if no description found
    if not description and brave_result.get("description"):
        description = brave_result["description"][:600]
    
    return {
        "title": title or "Job Opening",
        "company": company,
        "description": description[:600],
    }


async def scrape_job_from_url(url: str, profile_text: str) -> dict[str, Any]:
    """
    Scrape a job posting from a URL and extract details.
    
    Returns dict with keys:
    - title: Job title
    - company: Company name  
    - description: Job description
    - link: Original URL
    - company_info: Company background info (if available)
    """
    settings = get_settings()

    # Fetch raw HTML
    html = await fetch_page_html(url)

    # Try Brave Search for additional context
    brave_result = _use_brave_search_to_get_page_content(url, settings)

    # Extract job details using HTML parsing
    job_details = extract_job_details_from_html(html, url, brave_result)

    return {
        "title": job_details.get("title", "Job Opening"),
        "company": job_details.get("company", "Company"),
        "description": job_details.get("description", ""),
        "link": url,
        "company_info": "",  # Will be populated by company info service
    }

