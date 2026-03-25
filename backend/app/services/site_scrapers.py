"""Site-specific scrapers for extracting job details from various job boards."""

import json
import re
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlparse

from bs4 import BeautifulSoup, Tag


@dataclass
class ScrapeResult:
    """Structured result from scraping a job page."""
    title: str = "Job Opening"
    company: str = "Company"
    description: str = ""
    location: str = ""
    salary: str = ""
    employment_type: str = ""
    raw_text: str = ""
    extraction_method: str = ""
    confidence: float = 0.0
    metadata: dict = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clean_text(text: str) -> str:
    """Collapse whitespace and strip."""
    return re.sub(r"\s+", " ", text).strip()


def _soup(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, "html.parser")


def _extract_json_ld(soup: BeautifulSoup) -> dict[str, Any] | None:
    """Extract JSON-LD JobPosting structured data if present."""
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict) and item.get("@type") == "JobPosting":
                        return item
            elif isinstance(data, dict):
                if data.get("@type") == "JobPosting":
                    return data
                # Check @graph
                for item in data.get("@graph", []):
                    if isinstance(item, dict) and item.get("@type") == "JobPosting":
                        return item
        except (json.JSONDecodeError, TypeError):
            continue
    return None


def _full_visible_text(soup: BeautifulSoup) -> str:
    """Return all visible text from the page, skipping scripts/styles/nav/footer."""
    for tag in soup.find_all(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    return _clean_text(soup.get_text(separator=" "))


# ---------------------------------------------------------------------------
# Base class
# ---------------------------------------------------------------------------

class BaseSiteScraper:
    """Base class for site-specific scrapers."""

    name: str = "base"

    def can_handle(self, url: str) -> bool:
        raise NotImplementedError

    def extract(self, html: str, url: str) -> ScrapeResult:
        raise NotImplementedError


# ---------------------------------------------------------------------------
# Y Combinator
# ---------------------------------------------------------------------------

_YC_NAV_WORDS = {
    "y combinator", "about", "jobs", "apply", "footer", "programs",
    "resources", "log in", "sign up", "sign in", "login", "startup jobs",
    "partners", "library", "companies", "startup directory",
    "founder directory", "launch yc", "hacker news", "bookface", "safe",
    "find a co-founder", "make something people want.",
    "make something people want", "newsletter", "for investors",
}


class YCombinatorScraper(BaseSiteScraper):
    """Handles ycombinator.com/companies/*/jobs/* URLs.

    YC job pages render company name, job title, and description in a
    predictable structure. The company name is in the first h1 area,
    and the job title is typically the main heading of the job card.
    """

    name = "ycombinator"

    def can_handle(self, url: str) -> bool:
        host = urlparse(url).hostname or ""
        return "ycombinator.com" in host.lower()

    def extract(self, html: str, url: str) -> ScrapeResult:
        soup = _soup(html)
        result = ScrapeResult(extraction_method=self.name)

        # --- Company name ---
        # YC pages: URL pattern is /companies/{slug}/jobs/{id}-{title}
        # The URL slug is always the most reliable source.
        path = urlparse(url).path
        path_parts = [p for p in path.strip("/").split("/") if p]

        company = ""

        # Best source: URL slug (always present in /companies/{slug}/...)
        if len(path_parts) >= 2 and path_parts[0] == "companies":
            slug = path_parts[1]
            company = slug.replace("-", " ").title()

            # Try to get a better version from the page content
            # (the slug title-casing is decent but page text may be better,
            #  e.g. "Tamarind Bio" vs "Tamarind-Bio" → "Tamarind Bio")
            for a_tag in soup.find_all("a", href=True):
                href = a_tag.get("href", "")
                # Match links that point specifically to the company page
                if f"/companies/{slug}" in href and "/jobs" not in href.split(f"/companies/{slug}", 1)[-1][:6]:
                    text = _clean_text(a_tag.get_text())
                    # Must be a clean company name, not nav cruft or generic labels
                    if (text and 1 < len(text) < 80
                            and text.lower() not in _YC_NAV_WORDS
                            and text.lower() not in {"company", "jobs", "home", "careers"}
                            and "\n" not in text):
                        company = text
                        break

        # Last resort: search headings (with heavy filtering)
        if not company:
            for h in soup.find_all(["h1", "h2"]):
                text = _clean_text(h.get_text())
                if (text and 1 < len(text) < 60
                        and text.lower() not in _YC_NAV_WORDS):
                    company = text
                    break

        result.company = company or "Company"

        # --- Job title ---
        title = ""

        # YC job pages often have the job title in a specific heading
        # First try: look for headings that contain job-related keywords
        all_headings = []
        for h in soup.find_all(["h1", "h2", "h3"]):
            text = _clean_text(h.get_text())
            if text and len(text) > 3:
                all_headings.append(text)

        # Filter headings that look like job titles
        for heading in all_headings:
            lower = heading.lower()
            # Skip company name, page sections, and navigation items
            if heading == company:
                continue
            if lower in {"about the role", "qualifications and skills",
                         "about", "jobs", "founders", "footer"}:
                continue
            # Job titles typically contain role keywords
            if any(kw in lower for kw in [
                "engineer", "developer", "manager", "designer", "analyst",
                "scientist", "director", "lead", "intern", "associate",
                "coordinator", "specialist", "architect", "consultant",
                "vp", "head of", "chief", "officer", "biologist",
                "researcher", "operator", "founding", "senior", "junior",
                "staff", "principal", "full-stack", "backend", "frontend",
                "software", "product", "data", "machine learning", "ai",
                "sales", "marketing", "operations", "support", "customer",
            ]):
                title = heading
                break

        # Fall back to URL slug for title
        if not title and len(path_parts) >= 4:
            # Pattern: /companies/{slug}/jobs/{id}-{title}
            job_slug = path_parts[-1]
            # Remove the ID prefix (e.g., "5f42du-computational-biologist...")
            parts = job_slug.split("-", 1)
            if len(parts) > 1:
                title = parts[1].replace("-", " ").title()

        # Fall back to any non-company heading
        if not title:
            for heading in all_headings:
                if heading != company and len(heading) > 5:
                    title = heading
                    break

        result.title = title or "Job Opening"

        # --- Description ---
        description_parts = []

        # Look for "About the role" section or similar
        for h in soup.find_all(["h2", "h3", "h4"]):
            text = _clean_text(h.get_text()).lower()
            if any(kw in text for kw in ["about the role", "about this role",
                                          "description", "responsibilities",
                                          "qualifications", "requirements",
                                          "what you'll do", "what we're looking"]):
                # Collect siblings after this heading
                sibling = h.find_next_sibling()
                while sibling:
                    if isinstance(sibling, Tag) and sibling.name in ["h1", "h2"]:
                        break
                    sib_text = _clean_text(sibling.get_text())
                    if sib_text and len(sib_text) > 5:
                        description_parts.append(sib_text)
                    sibling = sibling.find_next_sibling()

        # Also look for paragraphs and list items in the main content area
        if not description_parts:
            for p in soup.find_all(["p", "li"]):
                text = _clean_text(p.get_text())
                if text and len(text) > 20:
                    description_parts.append(text)

        result.description = "\n".join(description_parts)

        # --- Location ---
        # Look for location-type text patterns
        page_text = _full_visible_text(_soup(html))
        location_match = re.search(
            r"(?:location|based in|located in)[:\s]+([^·\n]{3,50})",
            page_text, re.IGNORECASE,
        )
        if location_match:
            result.location = _clean_text(location_match.group(1))

        # --- Salary ---
        salary_match = re.search(
            r"\$[\d,]+[kK]?\s*[-–]\s*\$[\d,]+[kK]?", page_text,
        )
        if salary_match:
            result.salary = salary_match.group(0)

        result.raw_text = page_text
        result.confidence = 0.75 if result.description else 0.4
        return result


# ---------------------------------------------------------------------------
# Greenhouse
# ---------------------------------------------------------------------------

class GreenhouseScraper(BaseSiteScraper):
    """Handles boards.greenhouse.io/* URLs."""

    name = "greenhouse"

    def can_handle(self, url: str) -> bool:
        host = urlparse(url).hostname or ""
        return "greenhouse.io" in host.lower()

    def extract(self, html: str, url: str) -> ScrapeResult:
        soup = _soup(html)
        result = ScrapeResult(extraction_method=self.name)

        # JSON-LD first
        jld = _extract_json_ld(soup)
        if jld:
            result.title = jld.get("title", "")
            org = jld.get("hiringOrganization", {})
            if isinstance(org, dict):
                result.company = org.get("name", "")
            result.description = _clean_text(
                BeautifulSoup(jld.get("description", ""), "html.parser").get_text()
            )
            loc = jld.get("jobLocation", {})
            if isinstance(loc, dict):
                addr = loc.get("address", {})
                if isinstance(addr, dict):
                    parts = [addr.get("addressLocality", ""), addr.get("addressRegion", "")]
                    result.location = ", ".join(p for p in parts if p)
            result.confidence = 0.95
            result.raw_text = _full_visible_text(_soup(html))
            return result

        # Greenhouse-specific selectors
        title_tag = soup.select_one(".app-title") or soup.select_one("h1.heading")
        if title_tag:
            result.title = _clean_text(title_tag.get_text())

        company_tag = soup.select_one(".company-name") or soup.select_one("span.company-name")
        if company_tag:
            result.company = _clean_text(company_tag.get_text())
        else:
            # Extract from URL path: /companyname/jobs/...
            path_parts = [p for p in urlparse(url).path.strip("/").split("/") if p]
            if path_parts:
                result.company = path_parts[0].replace("-", " ").title()

        content = soup.select_one("#content") or soup.select_one(".content")
        if content:
            result.description = _clean_text(content.get_text())

        location_tag = soup.select_one(".location")
        if location_tag:
            result.location = _clean_text(location_tag.get_text())

        result.raw_text = _full_visible_text(_soup(html))
        result.confidence = 0.8 if result.description else 0.4
        return result


# ---------------------------------------------------------------------------
# Lever
# ---------------------------------------------------------------------------

class LeverScraper(BaseSiteScraper):
    """Handles jobs.lever.co/* URLs."""

    name = "lever"

    def can_handle(self, url: str) -> bool:
        host = urlparse(url).hostname or ""
        return "lever.co" in host.lower()

    def extract(self, html: str, url: str) -> ScrapeResult:
        soup = _soup(html)
        result = ScrapeResult(extraction_method=self.name)

        # JSON-LD
        jld = _extract_json_ld(soup)
        if jld:
            result.title = jld.get("title", "")
            org = jld.get("hiringOrganization", {})
            if isinstance(org, dict):
                result.company = org.get("name", "")
            result.description = _clean_text(
                BeautifulSoup(jld.get("description", ""), "html.parser").get_text()
            )
            result.confidence = 0.95
            result.raw_text = _full_visible_text(_soup(html))
            return result

        # Lever-specific selectors
        headline = soup.select_one(".posting-headline")
        if headline:
            h2 = headline.find("h2")
            if h2:
                result.title = _clean_text(h2.get_text())
            company_link = headline.select_one("a[href]")
            if company_link:
                result.company = _clean_text(company_link.get_text())

        # Fall back to URL for company: /company-name/job-id
        if result.company == "Company":
            path_parts = [p for p in urlparse(url).path.strip("/").split("/") if p]
            if path_parts:
                result.company = path_parts[0].replace("-", " ").title()

        # Description from section wrappers
        sections = soup.select(".section-wrapper .section")
        if sections:
            desc_parts = [_clean_text(s.get_text()) for s in sections]
            result.description = "\n\n".join(desc_parts)
        else:
            # Try broader content area
            content = soup.select_one(".content") or soup.select_one(".posting-page")
            if content:
                result.description = _clean_text(content.get_text())

        # Location
        loc_tag = soup.select_one(".posting-categories .sort-by-time") or soup.select_one(".location")
        if loc_tag:
            result.location = _clean_text(loc_tag.get_text())

        result.raw_text = _full_visible_text(_soup(html))
        result.confidence = 0.8 if result.description else 0.4
        return result


# ---------------------------------------------------------------------------
# Ashby
# ---------------------------------------------------------------------------

class AshbyScraper(BaseSiteScraper):
    """Handles jobs.ashbyhq.com/* URLs."""

    name = "ashby"

    def can_handle(self, url: str) -> bool:
        host = urlparse(url).hostname or ""
        return "ashbyhq.com" in host.lower()

    def extract(self, html: str, url: str) -> ScrapeResult:
        soup = _soup(html)
        result = ScrapeResult(extraction_method=self.name)

        # JSON-LD
        jld = _extract_json_ld(soup)
        if jld:
            result.title = jld.get("title", "")
            org = jld.get("hiringOrganization", {})
            if isinstance(org, dict):
                result.company = org.get("name", "")
            result.description = _clean_text(
                BeautifulSoup(jld.get("description", ""), "html.parser").get_text()
            )
            result.confidence = 0.95
            result.raw_text = _full_visible_text(_soup(html))
            return result

        # Ashby-specific selectors
        title_tag = soup.select_one("h1")
        if title_tag:
            result.title = _clean_text(title_tag.get_text())

        # Company from URL: /company-name/job-id
        path_parts = [p for p in urlparse(url).path.strip("/").split("/") if p]
        if path_parts:
            result.company = path_parts[0].replace("-", " ").title()

        # Description from main content
        content = soup.select_one("[data-testid='job-description']") or soup.select_one("main")
        if content:
            result.description = _clean_text(content.get_text())

        result.raw_text = _full_visible_text(_soup(html))
        result.confidence = 0.7 if result.description else 0.3
        return result


# ---------------------------------------------------------------------------
# LinkedIn
# ---------------------------------------------------------------------------

class LinkedInScraper(BaseSiteScraper):
    """Handles linkedin.com/jobs/* URLs.

    LinkedIn blocks most scraping. We rely heavily on meta tags (og:title,
    og:description) and any JSON-LD that may be present in the initial HTML.
    """

    name = "linkedin"

    def can_handle(self, url: str) -> bool:
        host = urlparse(url).hostname or ""
        return "linkedin.com" in host.lower()

    def extract(self, html: str, url: str) -> ScrapeResult:
        soup = _soup(html)
        result = ScrapeResult(extraction_method=self.name)

        # JSON-LD
        jld = _extract_json_ld(soup)
        if jld:
            result.title = jld.get("title", "")
            org = jld.get("hiringOrganization", {})
            if isinstance(org, dict):
                result.company = org.get("name", "")
            result.description = _clean_text(
                BeautifulSoup(jld.get("description", ""), "html.parser").get_text()
            )
            loc = jld.get("jobLocation", {})
            if isinstance(loc, dict):
                addr = loc.get("address", {})
                if isinstance(addr, dict):
                    parts = [addr.get("addressLocality", ""), addr.get("addressRegion", "")]
                    result.location = ", ".join(p for p in parts if p)
            result.confidence = 0.9
            result.raw_text = _full_visible_text(_soup(html))
            return result

        # OG meta tags (LinkedIn usually provides these even without auth)
        og_title = ""
        og_desc = ""
        for meta in soup.find_all("meta"):
            prop = meta.get("property", "") or meta.get("name", "")
            content = meta.get("content", "")
            if prop == "og:title":
                og_title = content
            elif prop in ("og:description", "description"):
                og_desc = content or og_desc

        if og_title:
            # LinkedIn og:title format: "Job Title at Company"
            if " at " in og_title:
                parts = og_title.rsplit(" at ", 1)
                result.title = parts[0].strip()
                result.company = parts[1].strip()
            # Also common: "Job Title - Company | LinkedIn"
            elif " - " in og_title:
                parts = og_title.split(" - ", 1)
                result.title = parts[0].strip()
                remainder = parts[1].split("|")[0].strip()
                if remainder.lower() != "linkedin":
                    result.company = remainder
            else:
                result.title = og_title.split("|")[0].strip()

        if og_desc:
            result.description = og_desc

        result.raw_text = _full_visible_text(_soup(html))
        result.confidence = 0.6 if result.description else 0.2
        return result


# ---------------------------------------------------------------------------
# Generic fallback
# ---------------------------------------------------------------------------

class GenericScraper(BaseSiteScraper):
    """Fallback for unknown sites. Uses JSON-LD, meta tags, and content
    analysis with BeautifulSoup."""

    name = "generic"

    def can_handle(self, _url: str) -> bool:
        return True  # always matches as fallback

    def extract(self, html: str, url: str) -> ScrapeResult:
        soup = _soup(html)
        result = ScrapeResult(extraction_method=self.name)

        # --- Try JSON-LD first (most reliable) ---
        jld = _extract_json_ld(soup)
        if jld:
            result.title = jld.get("title", "")
            org = jld.get("hiringOrganization", {})
            if isinstance(org, dict):
                result.company = org.get("name", "")
            raw_desc = jld.get("description", "")
            result.description = _clean_text(
                BeautifulSoup(raw_desc, "html.parser").get_text()
            )
            loc = jld.get("jobLocation", {})
            if isinstance(loc, dict):
                addr = loc.get("address", {})
                if isinstance(addr, dict):
                    parts = [addr.get("addressLocality", ""), addr.get("addressRegion", "")]
                    result.location = ", ".join(p for p in parts if p)
            salary = jld.get("baseSalary", {})
            if isinstance(salary, dict):
                val = salary.get("value", {})
                if isinstance(val, dict):
                    result.salary = f"${val.get('minValue', '')} - ${val.get('maxValue', '')}"
            result.confidence = 0.9
            result.raw_text = _full_visible_text(_soup(html))
            return result

        # --- OG meta tags ---
        og_title = ""
        og_desc = ""
        meta_desc = ""
        for meta in soup.find_all("meta"):
            prop = meta.get("property", "") or meta.get("name", "")
            content = meta.get("content", "")
            if prop == "og:title":
                og_title = content
            elif prop == "og:description":
                og_desc = content
            elif prop == "description":
                meta_desc = content

        # --- Title ---
        title_tag = soup.find("title")
        page_title = _clean_text(title_tag.get_text()) if title_tag else ""

        # Prefer og:title, fall back to <title>
        raw_title = og_title or page_title
        # Clean navigation cruft from title
        raw_title = re.sub(r"\s*\|.*", "", raw_title)
        raw_title = re.sub(r"\s*[-–]\s*(jobs|careers|hiring|home).*", "", raw_title, flags=re.IGNORECASE)
        result.title = raw_title.strip()[:150] or "Job Opening"

        # --- Company ---
        # Try "at Company" pattern in title
        if " at " in (og_title or page_title):
            result.company = (og_title or page_title).rsplit(" at ", 1)[-1].split("|")[0].strip()[:80]

        if result.company == "Company":
            # Extract from URL domain
            try:
                host = urlparse(url).hostname or ""
                host = host.replace("www.", "").split(".")[0]
                if host and len(host) > 2:
                    result.company = host.capitalize()
            except Exception:
                pass

        # --- Description ---
        # Use og:description, meta description, or page content
        if og_desc and len(og_desc) > 50:
            desc_parts = [og_desc]
        elif meta_desc and len(meta_desc) > 50:
            desc_parts = [meta_desc]
        else:
            desc_parts = []

        # Also collect main content paragraphs
        main_content = soup.select_one("main") or soup.select_one("article") or soup.select_one("#content") or soup.body
        if main_content:
            for tag in main_content.find_all(["script", "style", "nav", "footer", "header"]):
                tag.decompose()
            for p in main_content.find_all(["p", "li"]):
                text = _clean_text(p.get_text())
                if text and len(text) > 15:
                    desc_parts.append(text)

        result.description = "\n".join(desc_parts)
        result.raw_text = _full_visible_text(_soup(html))
        result.confidence = 0.5 if result.description else 0.2
        return result


# ---------------------------------------------------------------------------
# Router — picks the right scraper for a given URL
# ---------------------------------------------------------------------------

# Ordered by specificity (most specific first, generic last)
_SCRAPERS: list[BaseSiteScraper] = [
    YCombinatorScraper(),
    GreenhouseScraper(),
    LeverScraper(),
    AshbyScraper(),
    LinkedInScraper(),
    GenericScraper(),
]


def scrape_url(url: str, html: str) -> ScrapeResult:
    """Pick the appropriate site scraper and extract job details.

    Parameters
    ----------
    url : str
        The original job posting URL.
    html : str
        The raw HTML content of the page.

    Returns
    -------
    ScrapeResult
        Structured scrape result with title, company, description, etc.
    """
    for scraper in _SCRAPERS:
        if scraper.can_handle(url):
            return scraper.extract(html, url)

    # Should never reach here because GenericScraper always matches
    return GenericScraper().extract(html, url)
