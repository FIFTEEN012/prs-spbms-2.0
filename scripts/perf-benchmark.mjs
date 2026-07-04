const baseUrl = process.env.PERF_BASE_URL || "http://localhost:3000";
const username = process.env.PERF_USERNAME || "admin";
const password = process.env.PERF_PASSWORD || "password123";
const iterations = Number(process.env.PERF_ITERATIONS || 3);
const measureDbQueries = process.env.PERF_QUERY_COUNT === "1";

function cookieHeader(jar) {
  return Object.entries(jar)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

function storeCookies(jar, response) {
  const cookies = response.headers.getSetCookie
    ? response.headers.getSetCookie()
    : response.headers.get("set-cookie")
      ? [response.headers.get("set-cookie")]
      : [];

  for (const cookie of cookies) {
    const [pair] = cookie.split(";");
    const index = pair.indexOf("=");
    if (index > 0) {
      jar[pair.slice(0, index)] = pair.slice(index + 1);
    }
  }
}

async function login() {
  const jar = {};
  let response = await fetch(`${baseUrl}/api/auth/csrf`);
  storeCookies(jar, response);
  const { csrfToken } = await response.json();

  response = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookieHeader(jar),
    },
    body: new URLSearchParams({
      csrfToken,
      username,
      password,
      redirect: "false",
      json: "true",
      callbackUrl: `${baseUrl}/dashboard`,
    }),
    redirect: "manual",
  });
  storeCookies(jar, response);
  return jar;
}

async function timePath(jar, path) {
  const samples = [];
  let dbQueries;
  for (let index = 0; index < iterations; index += 1) {
    if (measureDbQueries) {
      await fetch(`${baseUrl}/api/perf/query-count`, {
        method: "POST",
        headers: { cookie: cookieHeader(jar) },
      });
    }

    const startedAt = performance.now();
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { cookie: cookieHeader(jar) },
    });
    await response.arrayBuffer();
    if (measureDbQueries) {
      const countResponse = await fetch(`${baseUrl}/api/perf/query-count`, {
        headers: { cookie: cookieHeader(jar) },
      });
      const payload = await countResponse.json().catch(() => null);
      if (typeof payload?.count === "number") dbQueries = payload.count;
    }
    samples.push({
      status: response.status,
      ms: Math.round(performance.now() - startedAt),
    });
  }

  const sorted = [...samples].sort((a, b) => a.ms - b.ms);
  return {
    route: path,
    status: sorted.at(-1)?.status,
    medianMs: sorted[Math.floor(sorted.length / 2)]?.ms ?? 0,
    samplesMs: samples.map((sample) => sample.ms),
    ...(typeof dbQueries === "number" ? { dbQueries } : {}),
  };
}

async function main() {
  const jar = await login();
  const projectResponse = await fetch(`${baseUrl}/api/projects?limit=1`, {
    headers: { cookie: cookieHeader(jar) },
  });
  const projectPayload = await projectResponse.json().catch(() => null);
  const projectId = projectPayload?.data?.[0]?.id;

  const routes = [
    "/dashboard",
    "/projects",
    "/approvals",
    "/budget",
    "/budget-allocation",
    "/procurement",
    "/academic-years",
    "/users",
    ...(projectId ? [`/projects/${projectId}`, `/projects/${projectId}/edit`] : []),
    "/projects/new",
    "/api/projects?page=1&limit=10",
    "/api/approvals?page=1&limit=10",
    "/api/procurements/requests?page=1&limit=10",
    "/api/users?page=1&limit=10",
    "/api/budget-wallets/summary",
  ];

  const results = [];
  for (const route of routes) {
    results.push(await timePath(jar, route));
  }

  console.log(JSON.stringify({
    baseUrl,
    username,
    iterations,
    dbQueryCountEnabled: measureDbQueries,
    measuredAt: new Date().toISOString(),
    results,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
