# Wastewater Research Library — Cloudflare Worker Backend

Fast, globally distributed edge backend for PDF text highlights, sticky notes, and live research badge tracking.

---

## ⚡ Why Cloudflare Workers over Vercel?
1. **0ms Cold Starts**: Instant response time with zero wake-up lag compared to Vercel serverless functions.
2. **Global Edge Execution**: Runs on Cloudflare's 300+ city edge network close to researchers in Australia, USA, etc.
3. **Multi-Line Highlight Preservation**: Full support for `boxes` array (retaining every line bounding box in multi-line highlights) and highlighted text strings without truncating to single-line rects.
4. **Simple Persistent Storage**: Direct Cloudflare KV key-value store with no complex blob token setup.
5. **Free Tier**: 100,000 requests/day and 1GB KV storage at zero cost.

---

## 🚀 Method 1 (Recommended): 2-Minute Deployment via Cloudflare Dashboard

You don't need to install Wrangler or use the terminal. You can do everything in your browser on [dash.cloudflare.com](https://dash.cloudflare.com/):

### 1. Create the Worker
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com/) and log in.
2. Click **Compute (Workers & Pages)** in the left sidebar.
3. Click **Create application** -> **Create Worker**.
4. Name it `wastewater-annotations` and click **Deploy**.

### 2. Paste the Worker Code
1. On the success screen, click **Edit code**.
2. Select all and delete the default starter code.
3. Copy the entire contents of [`src/index.js`](./src/index.js) and paste it into the editor.
4. Click **Deploy** (in the top right).

### 3. Add the KV Storage (For Persistent Highlights & Notes)
1. In Cloudflare's left sidebar, go to **Storage & Databases** -> **KV**.
2. Click **Create a namespace**, name it `ANNOTATIONS_KV`, and click **Add**.
3. Now go back to **Compute (Workers & Pages)** -> click your `wastewater-annotations` worker.
4. Click **Settings** tab -> **Bindings** (or **Variables and Secrets**) -> **KV Namespace Bindings** -> **Add binding**:
   - Variable name: `ANNOTATIONS_KV`
   - KV namespace: select `ANNOTATIONS_KV`
5. Click **Deploy** / **Save and Deploy**.

### 4. Connect to Your App
Copy your worker URL (e.g. `https://wastewater-annotations.sidcode3535.workers.dev`) and tell me or paste it into `annotation-config.js`:
```javascript
window.CLOUDFLARE_WORKER_URL = "https://wastewater-annotations.sidcode3535.workers.dev";
```
Save and commit. All PDF highlights, multi-line selections, notes, and badge counts will now save directly to Cloudflare!

---

## 💻 Method 2: Deploy via Wrangler CLI (Optional)

```bash
cd cloudflare-backend

# 1. Login to Cloudflare
npx wrangler login

# 2. Create the KV namespace
npx wrangler kv:namespace create ANNOTATIONS_KV

# 3. Paste the returned id into wrangler.toml under [[kv_namespaces]]

# 4. Deploy
npx wrangler deploy
```

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
