---
name: webapp-testing
description: Toolkit for interacting with and testing local web applications using Playwright. Supports verifying frontend functionality, debugging UI behavior, capturing browser screenshots, and viewing browser logs.
license: Complete terms in LICENSE.txt
---

# Web Application Testing

To test local web applications, write native Python Playwright scripts.

**Helper Scripts Available**:
- `scripts/with_server.py` - Manages server lifecycle (supports multiple servers)

**Always run scripts with `--help` first** to see usage. DO NOT read the source until you try running the script first and find that a customized solution is abslutely necessary. These scripts can be very large and thus pollute your context window. They exist to be called directly as black-box scripts rather than ingested into your context window.

## Decision Tree: Choosing Your Approach

```
User task → Is it static HTML?
    ├─ Yes → Read HTML file directly to identify selectors
    │         ├─ Success → Write Playwright script using selectors
    │         └─ Fails/Incomplete → Treat as dynamic (below)
    │
    └─ No (dynamic webapp) → Is the server already running?
        ├─ No → Run: python scripts/with_server.py --help
        │        Then use the helper + write simplified Playwright script
        │
        └─ Yes → Reconnaissance-then-action:
            1. Navigate and wait for networkidle
            2. Take screenshot or inspect DOM
            3. Identify selectors from rendered state
            4. Execute actions with discovered selectors
```

## Example: Using with_server.py

To start a server, run `--help` first, then use the helper:

**Single server:**
```bash
python scripts/with_server.py --server "npm run dev" --port 5173 -- python your_automation.py
```

**Multiple servers (e.g., backend + frontend):**
```bash
python scripts/with_server.py \
  --server "cd backend && python server.py" --port 3000 \
  --server "cd frontend && npm run dev" --port 5173 \
  -- python your_automation.py
```

To create an automation script, include only Playwright logic (servers are managed automatically):
```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True) # Always launch chromium in headless mode
    page = browser.new_page()
    page.goto('http://localhost:5173') # Server already running and ready
    page.wait_for_load_state('networkidle') # CRITICAL: Wait for JS to execute
    # ... your automation logic
    browser.close()
```

## Reconnaissance-Then-Action Pattern

1. **Inspect rendered DOM**:
   ```python
   page.screenshot(path='/tmp/inspect.png', full_page=True)
   content = page.content()
   page.locator('button').all()
   ```

2. **Identify selectors** from inspection results

3. **Execute actions** using discovered selectors

## Common Pitfall

❌ **Don't** inspect the DOM before waiting for `networkidle` on dynamic apps
✅ **Do** wait for `page.wait_for_load_state('networkidle')` before inspection

## Best Practices

- **Use bundled scripts as black boxes** - To accomplish a task, consider whether one of the scripts available in `scripts/` can help. These scripts handle common, complex workflows reliably without cluttering the context window. Use `--help` to see usage, then invoke directly. 
- Use `sync_playwright()` for synchronous scripts
- Always close the browser when done
- Use descriptive selectors: `text=`, `role=`, CSS selectors, or IDs
- Add appropriate waits: `page.wait_for_selector()` or `page.wait_for_timeout()`

## Reference Files

- **examples/** - Examples showing common patterns:
  - `element_discovery.py` - Discovering buttons, links, and inputs on a page
  - `static_html_automation.py` - Using file:// URLs for local HTML
  - `console_logging.py` - Capturing console logs during automation

## Next.js-Specific Testing Patterns

When testing a Next.js Pages Router application, use these additional patterns.

### Starting the Dev Server

```bash
python scripts/with_server.py --server "npm run dev" --port 3000 -- python your_test.py
```

### Testing Auth-Protected Pages

Admin pages use `getServerSideProps` with `checkAuth` — they redirect to `/login` without valid auth:

```python
# Test that admin pages redirect to login when unauthenticated
page.goto('http://localhost:3000/admin/articles')
page.wait_for_load_state('networkidle')
assert '/login' in page.url, f"Expected redirect to /login, got {page.url}"
```

### Testing Dynamic Routes

Pages like `/produse/[slug]` and `/admin/articles/edit/[id]`:

```python
# Test a dynamic product page
page.goto('http://localhost:3000/produse/some-product-slug')
page.wait_for_load_state('networkidle')
# Verify product content loaded
assert page.locator('h1').count() > 0

# Test 404 for non-existent slug
response = page.goto('http://localhost:3000/produse/nonexistent-slug-xyz')
assert response.status == 404
```

### Testing Middleware Behavior

The project uses middleware for www→non-www redirects and maintenance mode:

```python
# Test www redirect (if applicable)
# Test that maintenance mode works when MAINTENANCE=true

# Test that static files bypass middleware
page.goto('http://localhost:3000/images/logo.png')
assert page.locator('img').count() > 0 or response.status == 200
```

### Checking SEO Meta Tags

Verify `NextSeo` renders correct meta tags:

```python
page.goto('http://localhost:3000/about')
page.wait_for_load_state('networkidle')

# Check title
title = page.title()
assert 'About' in title

# Check meta description
meta_desc = page.locator('meta[name="description"]').get_attribute('content')
assert meta_desc and len(meta_desc) > 0

# Check OpenGraph
og_title = page.locator('meta[property="og:title"]').get_attribute('content')
assert og_title and len(og_title) > 0
```

### Testing Form Submissions

For React Hook Form-based forms:

```python
# Fill and submit a form
page.goto('http://localhost:3000/contact')
page.wait_for_load_state('networkidle')

page.fill('input[name="name"]', 'Test User')
page.fill('input[name="email"]', 'test@example.com')
page.fill('textarea[name="message"]', 'Test message content')
page.click('button[type="submit"]')

# Wait for success state
page.wait_for_selector('.toast-success', timeout=5000)
```