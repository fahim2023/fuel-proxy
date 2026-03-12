// ============================================================
//  UK PROXY SERVER — save this as server.js on your UK VPS
//  and run: node server.js
// ============================================================
//
// Requirements:
//   node >= 18  (uses built-in fetch)
//   npm install express
//
// Start: node server.js
// Port:  3000  (change PORT env var to override)
// ============================================================

// NOTE: This file is here for reference only — copy the code
// below to your UK server. It is NOT executed by Base44.

export default function ProxyServerDocs() {
  const code = `
const express = require('express');
const app = express();
app.use(express.json());

const BASE_URL = 'https://www.fuel-finder.service.gov.uk/api/v1';
const TOKEN_URL = \`\${BASE_URL}/oauth/generate_access_token\`;
const PRICES_URL = \`\${BASE_URL}/pfs/fuel-prices\`;

let cachedToken = null;
let tokenExpiry = 0;

async function getToken(clientId, clientSecret) {
  if (cachedToken && Date.now() < tokenExpiry - 60000) return cachedToken;
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(\`Auth failed \${res.status}: \${text}\`);
  }
  const data = await res.json();
  const tokenData = data.data || data;
  cachedToken = tokenData.access_token;
  tokenExpiry = Date.now() + (tokenData.expires_in * 1000);
  return cachedToken;
}

async function fetchBatch(token, batchNumber) {
  const res = await fetch(\`\${PRICES_URL}?batch-number=\${batchNumber}\`, {
    headers: { Authorization: \`Bearer \${token}\` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(\`API error \${res.status} on batch \${batchNumber}\`);
  const data = await res.json();
  return data.data || data;
}

function normalize(station) {
  const prices = {};
  if (Array.isArray(station.fuel_prices)) {
    for (const fp of station.fuel_prices) {
      if (fp.fuel_type && fp.price != null) prices[fp.fuel_type] = fp.price;
    }
  }
  return {
    id: station.node_id || station.site_id,
    brand: station.brand || station.trading_name || 'Unknown',
    address: [station.address, station.address_line_2].filter(Boolean).join(', '),
    town: station.town || '',
    county: station.county || '',
    postcode: station.postcode || '',
    lat: station.location?.latitude ?? station.latitude,
    lng: station.location?.longitude ?? station.longitude,
    prices,
  };
}

app.post('/fuel-stations', async (req, res) => {
  try {
    const { client_id, client_secret } = req.body;
    if (!client_id || !client_secret) {
      return res.status(400).json({ error: 'client_id and client_secret required' });
    }

    const token = await getToken(client_id, client_secret);
    const batch1 = await fetchBatch(token, 1);
    if (!batch1) return res.json({ stations: [], count: 0 });

    let all = [...batch1];
    if (batch1.length >= 500) {
      const batchPromises = [];
      for (let i = 2; i <= 40; i++) batchPromises.push(fetchBatch(token, i));
      const batches = await Promise.all(batchPromises);
      for (const batch of batches) {
        if (!batch || batch.length === 0) break;
        all.push(...batch);
        if (batch.length < 500) break;
      }
    }

    const stations = all.map(normalize).filter(s => s.lat != null && s.lng != null);
    res.json({ stations, count: stations.length });
  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`UK Fuel Proxy running on port \${PORT}\`));
`.trim();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2 text-white">
          UK Proxy Server Setup
        </h1>
        <p className="text-slate-400 mb-6">
          Deploy this on any UK-based server/VPS to proxy GOV.UK Fuel Finder API
          requests.
        </p>

        <div className="bg-slate-800 rounded-xl p-4 mb-6 border border-slate-700">
          <h2 className="font-semibold text-emerald-400 mb-3">Quick Setup</h2>
          <ol className="space-y-2 text-sm text-slate-300 list-decimal list-inside">
            <li>Spin up a UK VPS (DigitalOcean London, AWS eu-west-2, etc.)</li>
            <li>
              Install Node.js 18+ and run:{" "}
              <code className="bg-slate-900 px-1.5 py-0.5 rounded text-emerald-300">
                npm install express
              </code>
            </li>
            <li>
              Copy the code below into{" "}
              <code className="bg-slate-900 px-1.5 py-0.5 rounded text-emerald-300">
                server.js
              </code>
            </li>
            <li>
              Run:{" "}
              <code className="bg-slate-900 px-1.5 py-0.5 rounded text-emerald-300">
                node server.js
              </code>
            </li>
            <li>
              Set the{" "}
              <code className="bg-slate-900 px-1.5 py-0.5 rounded text-emerald-300">
                PROXY_URL
              </code>{" "}
              secret in Base44 to your server's public IP/URL, e.g.{" "}
              <code className="bg-slate-900 px-1.5 py-0.5 rounded text-emerald-300">
                http://1.2.3.4:3000
              </code>
            </li>
          </ol>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
            <span className="text-sm text-slate-400 font-mono">server.js</span>
            <button
              onClick={() => navigator.clipboard.writeText(code)}
              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Copy code
            </button>
          </div>
          <pre className="p-4 text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {code}
          </pre>
        </div>
      </div>
    </div>
  );
}
