import { performance } from 'perf_hooks';

const BASE_URL = 'http://localhost:3001/api';
const EMAIL = 'sam@jitims.com';
const PASSWORD = 'admin123';
const REQUESTS_COUNT = 50;

async function runPerfTest() {
  console.log('🏁 Starting API Performance Verification for /api/dashboard/analytics...');
  console.log(`📡 Base URL: ${BASE_URL}`);

  // 1. Authenticate
  console.log(`🔑 Authenticating as ${EMAIL}...`);
  let loginRes;
  try {
    loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
  } catch (err: any) {
    console.error(`❌ Failed to connect to server at ${BASE_URL}. Is the backend server running? Start it first using npm run dev.`, err.message);
    process.exit(1);
  }

  if (!loginRes.ok) {
    console.error(`❌ Authentication failed with status ${loginRes.status}`);
    const errText = await loginRes.text();
    console.error(errText);
    process.exit(1);
  }

  const { accessToken } = await loginRes.json() as { accessToken: string };
  console.log('✅ Authenticated successfully!');

  // 2. Perform 50 requests
  console.log(`⏱️  Sending ${REQUESTS_COUNT} sequential requests to /api/dashboard/analytics...`);
  const latencies: number[] = [];

  for (let i = 1; i <= REQUESTS_COUNT; i++) {
    const start = performance.now();
    try {
      const res = await fetch(`${BASE_URL}/dashboard/analytics`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const end = performance.now();
      const duration = end - start;

      if (!res.ok) {
        console.error(`❌ Request ${i} failed with status ${res.status}`);
        process.exit(1);
      }

      latencies.push(duration);
      if (i % 10 === 0 || i === 1) {
        console.log(`   Progress: ${i}/${REQUESTS_COUNT} requests completed...`);
      }
    } catch (err: any) {
      console.error(`❌ Request ${i} encountered an error:`, err.message);
      process.exit(1);
    }
  }

  // 3. Calculate statistics
  latencies.sort((a, b) => a - b);
  const sum = latencies.reduce((acc, val) => acc + val, 0);
  const min = latencies[0];
  const max = latencies[latencies.length - 1];
  const mean = sum / latencies.length;

  const getPercentile = (p: number) => {
    const idx = Math.ceil((p / 100) * latencies.length) - 1;
    return latencies[idx];
  };

  const p50 = getPercentile(50);
  const p95 = getPercentile(95);
  const p99 = getPercentile(99);

  console.log('\n=========================================');
  console.log('📊 PERFORMANCE METRICS REPORT');
  console.log('=========================================');
  console.log(`Total Requests:  ${REQUESTS_COUNT}`);
  console.log(`Min Latency:     ${min.toFixed(2)} ms`);
  console.log(`Max Latency:     ${max.toFixed(2)} ms`);
  console.log(`Mean Latency:    ${mean.toFixed(2)} ms`);
  console.log(`p50 (Median):    ${p50.toFixed(2)} ms`);
  console.log(`p95 Percentile:  ${p95.toFixed(2)} ms`);
  console.log(`p99 Percentile:  ${p99.toFixed(2)} ms`);
  console.log('=========================================');

  const p95Threshold = 500;
  if (p95 < p95Threshold) {
    console.log(`🟢 SUCCESS: p95 latency (${p95.toFixed(2)} ms) is below the 500 ms threshold!`);
    process.exit(0);
  } else {
    console.log(`🔴 FAILURE: p95 latency (${p95.toFixed(2)} ms) exceeded the 500 ms threshold.`);
    process.exit(1);
  }
}

runPerfTest().catch((err) => {
  console.error('❌ Unexpected error in performance test:', err);
  process.exit(1);
});
