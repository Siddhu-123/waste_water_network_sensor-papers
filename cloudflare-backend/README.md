# Wastewater Research Library — Cloudflare Worker Backend

Fast, globally distributed edge backend for PDF text highlights, sticky notes, and live research badge tracking.

---

## ⚡ Why Cloudflare Workers over Vercel?
1. **0ms Cold Starts**: Instant response time compared to Vercel serverless function wake-up latency.
2. **Global Edge Execution**: Runs on Cloudflare's 300+ city edge network close to researchers in Australia, USA, etc.
3. **Multi-Line Highlight Preservation**: Full support for `boxes` array (retaining every line bounding box in multi-line highlights) and highlighted text strings without truncating to single-line rects.
4. **Simple Persistent Storage**: Direct Cloudflare KV key-value store with no complex blob token setup.
5. **Free Tier**: 100,000 requests/day and 1GB KV storage at zero cost.

---

## 🚀 Quick Deployment Guide (2 Minutes)

### Step 1: Install Wrangler & Log In
Open your terminal in this directory:
```bash
cd "cloudflare-backend"
npx wrangler login
```
*This will open your browser to authorize Cloudflare.*

### Step 2: Create the KV Namespace for Annotations
Run:
```bash
npx wrangler kv:namespace create ANNOTATIONS_KV
```
You will get an output like:
```toml
[[kv_namespaces]]
binding = "ANNOTATIONS_KV"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

Copy the returned snippet and paste it into `wrangler.toml`.

*(Optional: create preview namespace for local dev)*:
```bash
npx wrangler kv:namespace create ANNOTATIONS_KV --preview
```

### Step 3: Deploy the Worker
Run:
```bash
npx wrangler deploy
```
Wrangler will output your live URL, for example:
```
https://wastewater-annotations-api.YOUR-SUBDOMAIN.workers.dev
```

### Step 4: Connect to the Frontend
Open `annotation-config.js` in the project root:
```javascript
window.CLOUDFLARE_WORKER_URL = "https://wastewater-annotations-api.YOUR-SUBDOMAIN.workers.dev";
```
Save and commit. That's it! The PDF viewer and main research library will now automatically save highlights, multi-line boxes, and notes directly to your Cloudflare Worker.

---

## 🛠 Local Development
To run the worker locally:
```bash
npx wrangler dev
```
Test endpoints:
- Health check: `http://localhost:8787/api/health`
- Summary: `http://localhost:8787/api/annotations`
- Paper annotations: `http://localhost:8787/api/annotations/1`

---

## 📡 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `OPTIONS` | `*` | Handles CORS preflight headers |
| `GET` | `/api/health` | Health check and KV status |
| `GET` | `/api/annotations` | Global summary for table badges & instructor view |
| `GET` | `/api/annotations/:paperId` | Fetch all highlights & notes for a specific paper |
| `POST` | `/api/annotations/:paperId` | Save annotations with full multi-line highlight boxes |
| `DELETE` | `/api/annotations/:paperId` | Delete annotations for a paper |
