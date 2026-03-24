# QuickApply: New Application Workflow

## Overview

The application workflow has been redesigned from a batch-based queue (ApplyQueue) to a link-based, one-by-one approach (QuickApply). This reduces unnecessary API calls and improves cover letter precision.

## User Flow

### Step 1: Paste a Job Link
User navigates to `/apply` and pastes a job posting URL from any job board:
- Greenhouse
- Lever  
- Ashby
- LinkedIn
- Indeed
- Generic job boards

### Step 2: System Extracts Job Details
The backend (`POST /api/apply/from-link`):
1. Scrapes the HTML from the URL
2. Extracts:
   - Job title
   - Company name
   - Job description
3. Falls back to Brave Search API if needed for better extraction

### Step 3: Fetch Company Background
Uses Brave Search to find company information (mission, overview, culture).
This helps the AI generate more contextually relevant cover letters.

### Step 4: AI Generates Cover Letter
Claude uses:
- User's resume/profile
- User's writing voice/tone
- Job description
- Company background

To generate a tailored cover letter.

### Step 5: User Review & Edit
User can:
- Read the extracted job details
- Review the cover letter
- Edit the cover letter inline
- Copy to clipboard

### Step 6: Mark as Applied
User clicks "Mark as Applied" to:
- Save the job to the tracker (status: "applied")
- Save the generated/edited cover letter
- Get confirmation

## Technical Architecture

### Frontend Components
- **QuickApply.tsx**: Main page with states:
  - Empty (input ready)
  - Loading (fetching & generating)
  - Loaded (showing results)
  - Applied (confirmation)

### Backend Services

#### Link Scraper (`services/link_scraper.py`)
```python
scrape_job_from_url(url: str, profile_text: str) -> dict
```
- Fetches HTML from URL
- Removes scripts/styles/tags
- Uses regex heuristics to extract job title, company, description
- Returns structured job data

#### Company Info (`services/company_info.py`)
```python
fetch_company_info(company_name: str) -> str
```
- Searches Brave API for company information
- Returns brief summary

#### Apply Router (`routers/apply.py`)
```
POST /api/apply/from-link
  Request: { url: string }
  Response: {
    job: { title, company, description, link, company_info },
    cover_letter: string,
    company_info: string
  }
```

### Database Changes
- Jobs can now be created with optional `status` and `cover_letter`
- CoverLetter records are automatically created alongside jobs

## Comparison: Old vs New

| Aspect | ApplyQueue (Old) | QuickApply (New) |
|--------|-----------------|-----------------|
| **Input** | Pre-loaded list from DB | Single URL from user |
| **API calls** | One per job in DB | One per job user wants to apply to |
| **Data freshness** | 24+ hours old (from search) | Real-time (scraped fresh) |
| **Precision** | Generic (batch scored) | High (tailored per job) |
| **Job source** | Limited to known job boards | Any job board |
| **Cover letters** | Batch generated upfront | Generated on-demand |
| **User flow** | Select → checklist → apply | Link → edit → confirm |

## Migration Notes

- Old `ApplyQueue.tsx` still exists but not imported
- `/apply` now routes to `QuickApply`
- Old endpoint `/api/apply/plan/{job_id}` still works (for backward compatibility)
- New endpoint `/api/apply/from-link` handles the new flow

## Limitations & Future Improvements

### Current Limitations
1. Job extraction uses basic regex (could use BeautifulSoup for better parsing)
2. Company info limited to Brave Search results (could add more APIs)
3. No support for form auto-fill yet (extension feature pending)
4. Rate-limited by Brave API quotas

### Potential Improvements
1. Add BeautifulSoup for more robust HTML parsing
2. Cache job details to avoid re-scraping
3. Support for LinkedIn job descriptions (requires special handling)
4. Batch apply mode for power users
5. Apply link history for users to track where they applied
6. Auto-detect optimal company website to scrape for more context
