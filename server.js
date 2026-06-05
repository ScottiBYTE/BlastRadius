const express = require("express");
const fs = require("fs");
const net = require("net");
const path = require("path");
const https = require("https");
const { URL } = require("url");
const dns = require("dns").promises;

const app = express();
const PORT = process.env.PORT || 3050;

const DATA_FILE = path.join(__dirname, "data", "homelab.json");
const CONFIG_FILE = path.join(__dirname, "data", "config.json");

const dockerDiscoveryCache = {
  createdAt: 0,
  data: null
};

const liveModelCache = {
  createdAt: 0,
  data: null,
  promise: null
};

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function readJson(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    console.error(`Failed to read ${filePath}:`, err.message);
    return fallback;
  }
}

function readModel() {
  return readJson(DATA_FILE, {
    generatedAt: new Date().toISOString(),
    components: [],
    links: [],
    services: [],
    issues: []
  });
}

function readConfig() {
  return readJson(CONFIG_FILE, {});
}

function resolveAppPath(filePath) {
  if (!filePath) return null;
  if (path.isAbsolute(filePath)) return filePath;
  return path.join(__dirname, filePath);
}

function normalizeBaseUrl(url) {
  return String(url || "").replace(/\/+$/, "");
}

function sanitizeId(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function findComponent(model, id) {
  return model.components.find((component) => component.id === id);
}

function impactedServices(model, componentId) {
  return model.services.filter((svc) => {
    if (svc.componentId === componentId) return true;
    return Array.isArray(svc.dependsOn) && svc.dependsOn.includes(componentId);
  });
}

function getPrimaryDomain(proxyHost) {
  const domains = Array.isArray(proxyHost.domain_names)
    ? proxyHost.domain_names
    : [];

  return domains[0] || `proxy-host-${proxyHost.id}`;
}

function getDomainOverride(config, proxyHost) {
  const overrides = config.npm && config.npm.domainOverrides
    ? config.npm.domainOverrides
    : {};

  const domains = Array.isArray(proxyHost.domain_names)
    ? proxyHost.domain_names
    : [];

  for (const domain of domains) {
    if (overrides[domain]) {
      return {
        domain,
        ...overrides[domain]
      };
    }
  }

  return null;
}

function getCheckMode(config, proxyHost) {
  const override = getDomainOverride(config, proxyHost);

  if (override && override.checkMode) {
    return String(override.checkMode).toLowerCase();
  }

  if (config.npm && config.npm.defaultCheckMode) {
    return String(config.npm.defaultCheckMode).toLowerCase();
  }

  return "tcp";
}

function isLoopbackIp(address) {
  return address === "127.0.0.1" || address === "0.0.0.0";
}

function isDockerBridgeInterface(interfaceName) {
  const name = String(interfaceName || "");
  return name === "docker0" || name.startsWith("br-");
}

function isDockerBridgeIp(address) {
  const ip = String(address || "");
  return (
    ip.startsWith("172.17.") ||
    ip.startsWith("172.18.") ||
    ip.startsWith("172.19.") ||
    ip.startsWith("172.20.") ||
    ip.startsWith("172.21.") ||
    ip.startsWith("172.22.") ||
    ip.startsWith("172.23.") ||
    ip.startsWith("172.24.") ||
    ip.startsWith("172.25.") ||
    ip.startsWith("172.26.") ||
    ip.startsWith("172.27.") ||
    ip.startsWith("172.28.") ||
    ip.startsWith("172.29.") ||
    ip.startsWith("172.30.") ||
    ip.startsWith("172.31.")
  );
}

function preferredIpv4(ipv4) {
  const addresses = Array.isArray(ipv4) ? ipv4 : [];

  const clean = addresses.filter((item) => item && item.address && !isLoopbackIp(item.address));

  if (!clean.length) return null;

  const ethPreferred = clean.find((item) =>
    !isDockerBridgeInterface(item.interface) &&
    !isDockerBridgeIp(item.address) &&
    (
      String(item.interface || "").startsWith("eth") ||
      String(item.interface || "").startsWith("enp") ||
      String(item.interface || "").startsWith("ens")
    )
  );

  if (ethPreferred) return ethPreferred;

  const nonDocker = clean.find((item) =>
    !isDockerBridgeInterface(item.interface) &&
    !isDockerBridgeIp(item.address)
  );

  if (nonDocker) return nonDocker;

  const ethAny = clean.find((item) =>
    String(item.interface || "").startsWith("eth") ||
    String(item.interface || "").startsWith("enp") ||
    String(item.interface || "").startsWith("ens")
  );

  if (ethAny) return ethAny;

  return clean[0];
}

function tcpCheck(host, port, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let finished = false;

    function done(result) {
      if (finished) return;
      finished = true;
      socket.destroy();
      resolve(result);
    }

    if (!host || !port) {
      return done({
        ok: false,
        host,
        port,
        message: "Missing host or port"
      });
    }

    socket.setTimeout(timeoutMs);

    socket.once("connect", () => {
      done({
        ok: true,
        host,
        port,
        message: "TCP port open"
      });
    });

    socket.once("timeout", () => {
      done({
        ok: false,
        host,
        port,
        message: "TCP timeout"
      });
    });

    socket.once("error", (err) => {
      done({
        ok: false,
        host,
        port,
        message: err.message
      });
    });

    socket.connect(Number(port), host);
  });
}

async function httpCheck(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal
    });

    clearTimeout(timer);

    return {
      ok: res.status >= 200 && res.status < 500,
      status: res.status,
      url,
      message: `HTTP ${res.status}`
    };
  } catch (err) {
    clearTimeout(timer);

    return {
      ok: false,
      status: null,
      url,
      message: err.name === "AbortError" ? "HTTP timeout" : err.message
    };
  }
}

async function npmLogin(npmConfig) {
  const baseUrl = normalizeBaseUrl(npmConfig.url);

  if (!baseUrl || !npmConfig.email || !npmConfig.password) {
    throw new Error("NPM configuration is incomplete. Check data/config.json.");
  }

  const res = await fetch(`${baseUrl}/api/tokens`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      identity: npmConfig.email,
      secret: npmConfig.password
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NPM login failed: HTTP ${res.status} ${text}`);
  }

  const data = await res.json();

  if (!data.token) {
    throw new Error("NPM login failed: token missing from response");
  }

  return data.token;
}

async function npmApiGet(npmConfig, endpoint) {
  const baseUrl = normalizeBaseUrl(npmConfig.url);
  const token = await npmLogin(npmConfig);

  const res = await fetch(`${baseUrl}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NPM API failed: HTTP ${res.status} ${text}`);
  }

  return res.json();
}

function createIncusHttpsOptions(config, remote) {
  const certPath = resolveAppPath(config.incus.cert);
  const keyPath = resolveAppPath(config.incus.key);

  if (!certPath || !keyPath || !fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    throw new Error("Incus client certificate/key missing. Check data/incus-client/client.crt and client.key.");
  }

  return {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
    rejectUnauthorized: remote.verifyTls !== undefined
      ? Boolean(remote.verifyTls)
      : Boolean(config.incus.verifyTls),
    timeout: remote.timeoutMs || config.incus.timeoutMs || 8000
  };
}

function appendProject(endpoint, project) {
  if (!project) return endpoint;
  const separator = endpoint.includes("?") ? "&" : "?";
  return `${endpoint}${separator}project=${encodeURIComponent(project)}`;
}

function httpsJsonRequest(fullUrl, options, method = "GET", body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(fullUrl);
    const payload = body ? JSON.stringify(body) : null;

    const req = https.request({
      hostname: url.hostname,
      port: url.port || 443,
      path: `${url.pathname}${url.search}`,
      method,
      cert: options.cert,
      key: options.key,
      rejectUnauthorized: options.rejectUnauthorized,
      timeout: options.timeout,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {})
      }
    }, (res) => {
      let responseBody = "";

      res.on("data", (chunk) => {
        responseBody += chunk;
      });

      res.on("end", () => {
        let parsed = null;

        try {
          parsed = responseBody ? JSON.parse(responseBody) : {};
        } catch (err) {
          return reject(new Error(`Invalid JSON from ${fullUrl}: ${err.message}`));
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode} from ${fullUrl}: ${responseBody}`));
        }

        resolve(parsed);
      });
    });

    req.on("timeout", () => {
      req.destroy(new Error(`Timeout calling ${fullUrl}`));
    });

    req.on("error", reject);

    if (payload) req.write(payload);
    req.end();
  });
}

function httpsTextGet(fullUrl, options) {
  return new Promise((resolve, reject) => {
    const url = new URL(fullUrl);

    const req = https.request({
      hostname: url.hostname,
      port: url.port || 443,
      path: `${url.pathname}${url.search}`,
      method: "GET",
      cert: options.cert,
      key: options.key,
      rejectUnauthorized: options.rejectUnauthorized,
      timeout: options.timeout,
      headers: {
        Accept: "text/plain, application/octet-stream, */*"
      }
    }, (res) => {
      let body = "";

      res.on("data", (chunk) => {
        body += chunk;
      });

      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode} from ${fullUrl}: ${body}`));
        }

        resolve(body);
      });
    });

    req.on("timeout", () => {
      req.destroy(new Error(`Timeout calling ${fullUrl}`));
    });

    req.on("error", reject);
    req.end();
  });
}

function httpsJsonGet(fullUrl, options) {
  return httpsJsonRequest(fullUrl, options, "GET");
}

function httpsJsonPost(fullUrl, options, body) {
  return httpsJsonRequest(fullUrl, options, "POST", body);
}

async function incusApiGet(config, remote, endpoint) {
  const baseUrl = normalizeBaseUrl(remote.url);
  const project = remote.project || "default";
  const finalEndpoint = appendProject(endpoint, project);
  const options = createIncusHttpsOptions(config, remote);
  const response = await httpsJsonGet(`${baseUrl}${finalEndpoint}`, options);

  if (response && Object.prototype.hasOwnProperty.call(response, "metadata")) {
    return response.metadata;
  }

  return response;
}

async function incusApiPost(config, remote, endpoint, body) {
  const baseUrl = normalizeBaseUrl(remote.url);
  const project = remote.project || "default";
  const finalEndpoint = appendProject(endpoint, project);
  const options = createIncusHttpsOptions(config, remote);
  const response = await httpsJsonPost(`${baseUrl}${finalEndpoint}`, options, body);

  if (response && Object.prototype.hasOwnProperty.call(response, "metadata")) {
    return response.metadata;
  }

  return response;
}

async function incusOperationWait(config, remote, operationIdOrUrl, timeoutSeconds = 15) {
  const baseUrl = normalizeBaseUrl(remote.url);
  const options = createIncusHttpsOptions(config, remote);

  let operationPath = String(operationIdOrUrl || "");

  if (operationPath.startsWith("http")) {
    const parsed = new URL(operationPath);
    operationPath = `${parsed.pathname}${parsed.search}`;
  }

  if (!operationPath.startsWith("/1.0/operations/")) {
    operationPath = `/1.0/operations/${encodeURIComponent(operationPath)}`;
  }

  const separator = operationPath.includes("?") ? "&" : "?";
  const waitPath = `${operationPath}/wait${separator}timeout=${encodeURIComponent(timeoutSeconds)}`;
  const response = await httpsJsonGet(`${baseUrl}${waitPath}`, options);

  if (response && Object.prototype.hasOwnProperty.call(response, "metadata")) {
    return response.metadata;
  }

  return response;
}

async function incusOperationLog(config, remote, operationIdOrUrl, logName) {
  const baseUrl = normalizeBaseUrl(remote.url);
  const options = createIncusHttpsOptions(config, remote);

  const outputPath = String(logName || "");

  /*
    Incus may return exec output references in either form:

      1. A simple log name
         stdout
         stderr

      2. A full API path
         /1.0/instances/<name>/logs/exec-output/<file>.stdout

    The first form belongs under:
      /1.0/operations/<operation>/logs/<name>

    The second form is already the full API path and must be fetched directly.
    Encoding that full path as a log filename causes a 404.
  */
  if (outputPath.startsWith("/1.0/")) {
    return httpsTextGet(`${baseUrl}${outputPath}`, options);
  }

  let operationPath = String(operationIdOrUrl || "");

  if (operationPath.startsWith("http")) {
    const parsed = new URL(operationPath);
    operationPath = `${parsed.pathname}${parsed.search}`;
  }

  if (!operationPath.startsWith("/1.0/operations/")) {
    operationPath = `/1.0/operations/${encodeURIComponent(operationPath)}`;
  }

  return httpsTextGet(`${baseUrl}${operationPath}/logs/${encodeURIComponent(outputPath)}`, options);
}

function extractOperationId(operationMetadata) {
  if (!operationMetadata) return null;
  if (operationMetadata.id) return operationMetadata.id;
  if (operationMetadata.operation) return operationMetadata.operation;
  if (operationMetadata.location) return operationMetadata.location;
  return null;
}

function extractExecOutputMap(waitMetadata) {
  if (!waitMetadata) return {};
  if (waitMetadata.output) return waitMetadata.output;
  if (waitMetadata.metadata && waitMetadata.metadata.output) return waitMetadata.metadata.output;
  return {};
}

async function incusExec(config, remote, instanceName, command, timeoutMs = 8000) {
  const timeoutSeconds = Math.max(5, Math.ceil(timeoutMs / 1000));

  const operationMetadata = await incusApiPost(
    config,
    remote,
    `/1.0/instances/${encodeURIComponent(instanceName)}/exec`,
    {
      command,
      "wait-for-websocket": false,
      interactive: false,
      "record-output": true
    }
  );

  const operationId = extractOperationId(operationMetadata);

  if (!operationId) {
    throw new Error("Incus exec did not return an operation id.");
  }

  const waitMetadata = await incusOperationWait(config, remote, operationId, timeoutSeconds);
  const outputMap = extractExecOutputMap(waitMetadata);

  let stdout = "";
  let stderr = "";

  if (outputMap["1"]) {
    stdout = await incusOperationLog(config, remote, operationId, outputMap["1"]);
  }

  if (outputMap["2"]) {
    stderr = await incusOperationLog(config, remote, operationId, outputMap["2"]);
  }

  const returnCode =
    waitMetadata &&
    waitMetadata.metadata &&
    waitMetadata.metadata.return
      ? waitMetadata.metadata.return
      : waitMetadata && Object.prototype.hasOwnProperty.call(waitMetadata, "return")
        ? waitMetadata.return
        : 0;

  return {
    operationId,
    returnCode,
    stdout,
    stderr
  };
}

function extractIpv4FromState(state) {
  const ipv4 = [];
  const network = state && state.network ? state.network : {};

  for (const [interfaceName, interfaceData] of Object.entries(network)) {
    const addresses = interfaceData.addresses || [];

    for (const address of addresses) {
      if (address.family === "inet" && address.address) {
        ipv4.push({
          address: address.address,
          interface: interfaceName
        });
      }
    }
  }

  return ipv4;
}

function snapshotCountFromInstance(instance) {
  if (Array.isArray(instance.snapshots)) return instance.snapshots.length;
  if (typeof instance.snapshots === "number") return instance.snapshots;
  return 0;
}

async function discoverIncus() {
  const config = readConfig();

  if (!config.incus || !config.incus.enabled) {
    return {
      enabled: false,
      instances: [],
      errors: [],
      message: "Incus discovery is disabled or not configured."
    };
  }

  const remotes = Array.isArray(config.incus.remotes)
    ? config.incus.remotes.filter((remote) => remote.enabled)
    : [];

  const instances = [];
  const errors = [];

  for (const remote of remotes) {
    try {
      const list = await incusApiGet(config, remote, "/1.0/instances?recursion=1");

      for (const instance of list) {
        let state = null;
        let ipv4 = [];

        const status = instance.status || instance.stateful || "Unknown";
        const isRunning = String(status).toLowerCase() === "running";

        if (isRunning && instance.name) {
          try {
            state = await incusApiGet(
              config,
              remote,
              `/1.0/instances/${encodeURIComponent(instance.name)}/state`
            );
            ipv4 = extractIpv4FromState(state);
          } catch (stateErr) {
            errors.push({
              remote: remote.name,
              instance: instance.name,
              error: `State lookup failed: ${stateErr.message}`
            });
          }
        }

        const preferred = preferredIpv4(ipv4);

        instances.push({
          id: `incus-instance-${sanitizeId(remote.name)}-${sanitizeId(instance.name)}`,
          remote: remote.name,
          remoteUrl: remote.url,
          project: remote.project || "default",
          name: instance.name,
          status,
          type: instance.type || "unknown",
          snapshots: snapshotCountFromInstance(instance),
          ipv4,
          preferredIp: preferred ? preferred.address : null,
          preferredInterface: preferred ? preferred.interface : null
        });
      }
    } catch (err) {
      errors.push({
        remote: remote.name,
        url: remote.url,
        error: err.message
      });
    }
  }

  return {
    enabled: true,
    instances,
    errors,
    message: `Discovered ${instances.length} Incus instances across ${remotes.length} enabled remotes.`
  };
}

function findRemoteConfig(config, remoteName) {
  const remotes = config.incus && Array.isArray(config.incus.remotes)
    ? config.incus.remotes
    : [];

  return remotes.find((remote) => remote.enabled && remote.name === remoteName) || null;
}

function parseDockerPsJsonLines(stdout) {
  const lines = String(stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const containers = [];
  const errors = [];

  for (const line of lines) {
    try {
      const raw = JSON.parse(line);

      const state = String(raw.State || raw.Status || "").toLowerCase();
      const statusText = String(raw.Status || "");
      const isRunning = raw.State
        ? String(raw.State).toLowerCase() === "running"
        : statusText.toLowerCase().includes("up");

      const isUnhealthy = statusText.toLowerCase().includes("unhealthy");

      containers.push({
        id: raw.ID || raw.Id || null,
        image: raw.Image || null,
        command: raw.Command || null,
        createdAt: raw.CreatedAt || null,
        runningFor: raw.RunningFor || null,
        ports: raw.Ports || "",
        status: raw.Status || raw.State || "unknown",
        state: isRunning ? "running" : state || "unknown",
        names: raw.Names || raw.Name || "",
        labels: raw.Labels || "",
        networks: raw.Networks || "",
        mounts: raw.Mounts || "",
        localVolumes: raw.LocalVolumes || "",
        size: raw.Size || "",
        unhealthy: isUnhealthy
      });
    } catch (err) {
      errors.push({
        line,
        error: err.message
      });
    }
  }

  return { containers, errors };
}

function summarizeDockerContainers(containers) {
  const list = Array.isArray(containers) ? containers : [];

  return {
    available: true,
    total: list.length,
    running: list.filter((item) => item.state === "running").length,
    stopped: list.filter((item) => item.state !== "running").length,
    unhealthy: list.filter((item) => item.unhealthy).length
  };
}

async function discoverDockerForInstance(config, remote, instance, dockerConfig) {
  const timeoutMs = dockerConfig.timeoutMs || 8000;

  if (String(instance.status || "").toLowerCase() !== "running") {
    return {
      available: false,
      reason: "Incus instance is not running.",
      remote: instance.remote,
      instance: instance.name,
      containers: [],
      summary: {
        available: false,
        total: 0,
        running: 0,
        stopped: 0,
        unhealthy: 0
      }
    };
  }

  const command = [
    "sh",
    "-lc",
    "command -v docker >/dev/null 2>&1 && docker ps -a --format '{{json .}}' || { echo 'docker command not found' >&2; exit 127; }"
  ];

  try {
    const execResult = await incusExec(config, remote, instance.name, command, timeoutMs);

    if (execResult.returnCode !== 0) {
      return {
        available: false,
        reason: execResult.stderr || execResult.stdout || `docker ps failed with return code ${execResult.returnCode}`,
        remote: instance.remote,
        instance: instance.name,
        containers: [],
        summary: {
          available: false,
          total: 0,
          running: 0,
          stopped: 0,
          unhealthy: 0
        }
      };
    }

    const parsed = parseDockerPsJsonLines(execResult.stdout);
    const summary = summarizeDockerContainers(parsed.containers);

    return {
      available: true,
      reason: "Docker discovery succeeded.",
      remote: instance.remote,
      instance: instance.name,
      containers: parsed.containers,
      parseErrors: parsed.errors,
      summary
    };
  } catch (err) {
    return {
      available: false,
      reason: err.message,
      remote: instance.remote,
      instance: instance.name,
      containers: [],
      summary: {
        available: false,
        total: 0,
        running: 0,
        stopped: 0,
        unhealthy: 0
      }
    };
  }
}

async function discoverNestedDocker(incusDiscovery = null, force = false) {
  const config = readConfig();
  const dockerConfig = config.dockerDiscovery || {};

  if (!dockerConfig.enabled) {
    return {
      enabled: false,
      cached: false,
      instances: [],
      errors: [],
      message: "Nested Docker discovery is disabled or not configured."
    };
  }

  const cacheSeconds = dockerConfig.cacheSeconds || 300;
  const cacheValid =
    dockerDiscoveryCache.data &&
    Date.now() - dockerDiscoveryCache.createdAt < cacheSeconds * 1000;

  if (!force && cacheValid) {
    return {
      ...dockerDiscoveryCache.data,
      cached: true
    };
  }

  const discoveredIncus = incusDiscovery || await discoverIncus();

  if (!discoveredIncus.enabled) {
    return {
      enabled: false,
      cached: false,
      instances: [],
      errors: [],
      message: "Nested Docker discovery requires Incus discovery."
    };
  }

  const runningContainers = discoveredIncus.instances.filter((instance) =>
    instance.type === "container" &&
    String(instance.status || "").toLowerCase() === "running"
  );

  const maxInstances = dockerConfig.maxInstances || 25;
  const selectedInstances = runningContainers.slice(0, maxInstances);
  const results = [];
  const errors = [];

  for (const instance of selectedInstances) {
    const remote = findRemoteConfig(config, instance.remote);

    if (!remote) {
      errors.push({
        remote: instance.remote,
        instance: instance.name,
        error: "Remote config not found."
      });
      continue;
    }

    const result = await discoverDockerForInstance(config, remote, instance, dockerConfig);
    results.push(result);

    if (!result.available) {
      errors.push({
        remote: instance.remote,
        instance: instance.name,
        error: result.reason
      });
    }
  }

  const enabledResults = results.filter((item) => item.available);
  const totalContainers = results.reduce((sum, item) => sum + (item.summary ? item.summary.total : 0), 0);
  const running = results.reduce((sum, item) => sum + (item.summary ? item.summary.running : 0), 0);
  const stopped = results.reduce((sum, item) => sum + (item.summary ? item.summary.stopped : 0), 0);
  const unhealthy = results.reduce((sum, item) => sum + (item.summary ? item.summary.unhealthy : 0), 0);

  const response = {
    enabled: true,
    cached: false,
    checkedAt: new Date().toISOString(),
    scannedInstances: selectedInstances.length,
    totalEligibleInstances: runningContainers.length,
    capped: runningContainers.length > selectedInstances.length,
    maxInstances,
    instances: results,
    errors,
    summary: {
      dockerAvailableInstances: enabledResults.length,
      totalContainers,
      running,
      stopped,
      unhealthy
    },
    message: `Discovered nested Docker on ${enabledResults.length} of ${selectedInstances.length} scanned Incus containers.`
  };

  dockerDiscoveryCache.createdAt = Date.now();
  dockerDiscoveryCache.data = response;

  return response;
}

function findDockerForInstance(dockerDiscovery, instance) {
  if (!dockerDiscovery || !Array.isArray(dockerDiscovery.instances) || !instance) return null;

  return dockerDiscovery.instances.find((item) =>
    item.remote === instance.remote &&
    item.instance === instance.name
  ) || null;
}

function findIncusOwnerByIp(incusDiscovery, ipAddress) {
  if (!incusDiscovery || !Array.isArray(incusDiscovery.instances)) return null;

  for (const instance of incusDiscovery.instances) {
    const match = (instance.ipv4 || []).find((item) => item.address === ipAddress);
    if (match) {
      return {
        ...instance,
        matchedIp: match.address,
        matchedInterface: match.interface
      };
    }
  }

  return null;
}

function ensureCoreComponents(model) {
  const components = Array.isArray(model.components) ? [...model.components] : [];
  const existing = new Set(components.map((c) => c.id));

  const defaults = [
    {
      id: "internet",
      name: "Internet",
      type: "external",
      status: "ok",
      subtitle: "External"
    },
    {
      id: "cloudflare",
      name: "Cloudflare DNS",
      type: "dns",
      status: "ok",
      subtitle: "scottibyte.com"
    },
    {
      id: "udm-beast",
      name: "UDM Beast",
      type: "unifi-device",
      status: "ok",
      subtitle: "172.16.0.1"
    },
    {
      id: "npm",
      name: "Nginx Proxy Manager",
      type: "proxy-host",
      status: "ok",
      subtitle: "Public reverse proxy"
    }
  ];

  for (const item of defaults) {
    if (!existing.has(item.id)) {
      components.push(item);
      existing.add(item.id);
    }
  }

  return components;
}

function incusRemoteComponent(remoteName) {
  return {
    id: `incus-remote-${sanitizeId(remoteName)}`,
    name: remoteName,
    type: "incus-host",
    status: "ok",
    subtitle: "Incus remote"
  };
}

function incusInstanceComponent(instance, dockerDiscovery = null) {
  const displayIp = instance.preferredIp || "no IPv4";
  const docker = findDockerForInstance(dockerDiscovery, instance);

  return {
    id: instance.id,
    name: instance.name,
    type: "incus-instance",
    status: String(instance.status).toLowerCase() === "running" ? "ok" : "offline",
    subtitle: `${instance.remote} / ${displayIp}`,
    incus: {
      ...instance,
      nestedDocker: docker || null
    }
  };
}

function dockerContainerComponent(instance, container) {
  const status = container.unhealthy
    ? "degraded"
    : container.state === "running"
      ? "ok"
      : "offline";

  return {
    id: `docker-${sanitizeId(instance.remote)}-${sanitizeId(instance.name)}-${sanitizeId(container.names || container.id)}`,
    name: container.names || container.id || "docker-container",
    type: "docker-container",
    status,
    subtitle: `${instance.remote} / ${instance.name}`,
    docker: {
      ...container,
      incusRemote: instance.remote,
      incusInstance: instance.name
    }
  };
}

function isCheckBroken(check) {
  if (!check) return false;
  if (check.checkMode === "skip") return false;
  if (check.checkMode === "public") return check.publicHttp && check.publicHttp.ok === false;
  if (check.checkMode === "http") return check.http && check.http.ok === false;
  return check.tcp && check.tcp.ok === false;
}

function proxyHostToComponent(proxyHost, checkResult = null, incusOwner = null) {
  const primaryDomain = getPrimaryDomain(proxyHost);

  let status = "ok";

  if (!proxyHost.enabled) {
    status = "offline";
  } else if (isCheckBroken(checkResult)) {
    status = "degraded";
  }

  return {
    id: `npm-proxy-${proxyHost.id}`,
    name: primaryDomain,
    type: "proxy-host",
    status,
    subtitle: incusOwner
      ? `${incusOwner.remote} / ${incusOwner.name}`
      : `${proxyHost.forward_host}:${proxyHost.forward_port}`,
    npm: {
      id: proxyHost.id,
      enabled: proxyHost.enabled,
      forwardScheme: proxyHost.forward_scheme,
      forwardHost: proxyHost.forward_host,
      forwardPort: proxyHost.forward_port,
      domains: proxyHost.domain_names || []
    },
    incusOwner,
    checkMode: checkResult ? checkResult.checkMode : "tcp"
  };
}

function proxyHostToService(proxyHost, checkResult = null, incusOwner = null) {
  const domains = Array.isArray(proxyHost.domain_names)
    ? proxyHost.domain_names
    : [];

  const primaryDomain = getPrimaryDomain(proxyHost);
  const componentId = `npm-proxy-${proxyHost.id}`;

  let status = "healthy";

  if (!proxyHost.enabled) {
    status = "offline";
  } else if (isCheckBroken(checkResult)) {
    status = "degraded";
  }

  const dependsOn = [
    "internet",
    "cloudflare",
    "udm-beast",
    "npm",
    componentId
  ];

  if (incusOwner) {
    dependsOn.push(`incus-remote-${sanitizeId(incusOwner.remote)}`);
    dependsOn.push(incusOwner.id);
  }

  return {
    id: `svc-npm-${proxyHost.id}`,
    name: primaryDomain,
    type: "Public Proxy",
    status,
    componentId,
    location: incusOwner
      ? `${incusOwner.remote} / ${incusOwner.name} / ${proxyHost.forward_host}:${proxyHost.forward_port}`
      : `${proxyHost.forward_host}:${proxyHost.forward_port}`,
    urls: domains,
    dependencies: dependsOn.length,
    lastCheck: "just now",
    dependsOn,
    npm: {
      id: proxyHost.id,
      enabled: proxyHost.enabled,
      forwardScheme: proxyHost.forward_scheme,
      forwardHost: proxyHost.forward_host,
      forwardPort: proxyHost.forward_port,
      domains
    },
    incusOwner,
    check: checkResult
  };
}

async function discoverNpmProxyHosts() {
  const config = readConfig();

  if (!config.npm || !config.npm.enabled) {
    return {
      enabled: false,
      proxyHosts: [],
      checks: [],
      message: "NPM discovery is disabled or not configured."
    };
  }

  const timeoutMs = config.npm.timeoutMs || 5000;
  const proxyHosts = await npmApiGet(config.npm, "/api/nginx/proxy-hosts");
  const checks = [];

  for (const host of proxyHosts) {
    const forwardHost = host.forward_host;
    const forwardPort = Number(host.forward_port);
    const forwardScheme = host.forward_scheme || "http";
    const targetUrl = `${forwardScheme}://${forwardHost}:${forwardPort}`;
    const primaryDomain = getPrimaryDomain(host);
    const checkMode = getCheckMode(config, host);
    const override = getDomainOverride(config, host);

    let tcp = {
      ok: null,
      host: forwardHost,
      port: forwardPort,
      message: "TCP check not run"
    };

    let http = {
      ok: null,
      status: null,
      url: targetUrl,
      message: "HTTP check not run"
    };

    let publicHttp = {
      ok: null,
      status: null,
      url: `https://${primaryDomain}`,
      message: "Public HTTP check not run"
    };

    if (checkMode === "skip") {
      tcp.message = override && override.note ? override.note : "Health check skipped by domain override";
      http.message = tcp.message;
      publicHttp.message = tcp.message;
    } else if (checkMode === "public") {
      publicHttp = await httpCheck(`https://${primaryDomain}`, timeoutMs);
    } else if (checkMode === "http") {
      http = await httpCheck(targetUrl, timeoutMs);
    } else {
      tcp = await tcpCheck(forwardHost, forwardPort, timeoutMs);
    }

    checks.push({
      id: host.id,
      domains: host.domain_names || [],
      enabled: host.enabled,
      forwardHost,
      forwardPort,
      forwardScheme,
      targetUrl,
      checkMode,
      override: override || null,
      tcp,
      http,
      publicHttp
    });
  }

  return {
    enabled: true,
    proxyHosts,
    checks,
    message: `Discovered ${proxyHosts.length} NPM proxy hosts.`
  };
}

function certificateDiscoveryConfig(config) {
  const certConfig = config.certificateDiscovery || {};

  return {
    enabled: certConfig.enabled !== false,
    highDays: Number(certConfig.highDays || 7),
    mediumDays: Number(certConfig.mediumDays || 21),
    lowDays: Number(certConfig.lowDays || 45)
  };
}

function parseCertificateDate(value) {
  if (!value) return null;

  if (typeof value === "number") {
    const date = new Date(value > 9999999999 ? value : value * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const text = String(value).trim();
  if (!text) return null;

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function findCertificateExpiry(cert) {
  const candidates = [
    cert.expires_on,
    cert.expiresOn,
    cert.expires,
    cert.expiry,
    cert.expiration,
    cert.not_after,
    cert.notAfter,
    cert.valid_to,
    cert.validTo,
    cert.meta && cert.meta.expires_on,
    cert.meta && cert.meta.expiresOn,
    cert.meta && cert.meta.expires,
    cert.meta && cert.meta.expiry,
    cert.meta && cert.meta.expiration,
    cert.meta && cert.meta.not_after,
    cert.meta && cert.meta.valid_to
  ];

  for (const candidate of candidates) {
    const parsed = parseCertificateDate(candidate);
    if (parsed) return parsed;
  }

  return null;
}

function daysUntil(date) {
  if (!date) return null;
  const now = new Date();
  const ms = date.getTime() - now.getTime();
  return Math.ceil(ms / 86400000);
}

function certificateDomains(cert) {
  const domains = [];

  for (const value of [
    cert.domain_names,
    cert.domains,
    cert.names,
    cert.meta && cert.meta.domain_names,
    cert.meta && cert.meta.domains
  ]) {
    if (Array.isArray(value)) domains.push(...value);
  }

  if (cert.nice_name) domains.push(cert.nice_name);
  if (cert.domain) domains.push(cert.domain);

  return [...new Set(domains.filter(Boolean).map((item) => String(item)))];
}

function certificateName(cert) {
  const domains = certificateDomains(cert);
  return cert.nice_name || cert.name || domains[0] || `certificate-${cert.id}`;
}

function normalizeCertificate(cert) {
  const expiresAt = findCertificateExpiry(cert);
  const remainingDays = daysUntil(expiresAt);
  const domains = certificateDomains(cert);

  return {
    id: cert.id,
    name: certificateName(cert),
    provider: cert.provider || cert.type || cert.meta?.provider || "unknown",
    domains,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    daysRemaining: remainingDays,
    raw: cert
  };
}

async function discoverNpmCertificates() {
  const config = readConfig();

  if (!config.npm || !config.npm.enabled) {
    return {
      enabled: false,
      certificates: [],
      errors: [],
      message: "Certificate discovery requires NPM discovery."
    };
  }

  const certConfig = certificateDiscoveryConfig(config);

  if (!certConfig.enabled) {
    return {
      enabled: false,
      certificates: [],
      errors: [],
      message: "Certificate discovery is disabled."
    };
  }

  try {
    const certificates = await npmApiGet(config.npm, "/api/nginx/certificates");

    return {
      enabled: true,
      certificates: Array.isArray(certificates)
        ? certificates.map(normalizeCertificate)
        : [],
      errors: [],
      thresholds: certConfig,
      message: `Discovered ${Array.isArray(certificates) ? certificates.length : 0} NPM certificates.`
    };
  } catch (err) {
    return {
      enabled: false,
      certificates: [],
      errors: [
        {
          error: err.message
        }
      ],
      thresholds: certConfig,
      message: `Certificate discovery failed: ${err.message}`
    };
  }
}

function certificateSeverity(daysRemaining, thresholds) {
  if (daysRemaining === null || daysRemaining === undefined) return null;
  if (daysRemaining <= thresholds.highDays) return "high";
  if (daysRemaining <= thresholds.mediumDays) return "medium";
  if (daysRemaining <= thresholds.lowDays) return "low";
  return null;
}

function certificateIssueText(cert, severity) {
  if (cert.daysRemaining < 0) {
    return `SSL certificate ${cert.name} expired ${Math.abs(cert.daysRemaining)} day(s) ago.`;
  }

  if (cert.daysRemaining === 0) {
    return `SSL certificate ${cert.name} expires today.`;
  }

  return `SSL certificate ${cert.name} expires in ${cert.daysRemaining} day(s).`;
}

function certificateAffectedProxyHosts(cert, proxyHosts) {
  const domains = new Set((cert.domains || []).map((domain) => String(domain).toLowerCase()));
  const matches = [];

  for (const proxyHost of proxyHosts || []) {
    const proxyDomains = Array.isArray(proxyHost.domain_names) ? proxyHost.domain_names : [];
    const certificateIdMatches =
      cert.id !== undefined &&
      proxyHost.certificate_id !== undefined &&
      Number(proxyHost.certificate_id) === Number(cert.id);

    const domainMatches = proxyDomains.some((domain) =>
      domains.has(String(domain).toLowerCase())
    );

    if (certificateIdMatches || domainMatches) {
      matches.push({
        id: proxyHost.id,
        enabled: proxyHost.enabled,
        domains: proxyDomains,
        forwardHost: proxyHost.forward_host,
        forwardPort: proxyHost.forward_port
      });
    }
  }

  return matches;
}

function externalUseCertificateMap(config) {
  const certConfig = config.certificateDiscovery || {};
  return certConfig.externalUseCertificates || {};
}

function certificateExternalUse(cert, config) {
  const externalMap = externalUseCertificateMap(config);
  const names = new Set([
    cert.name,
    ...(cert.domains || [])
  ].filter(Boolean).map((item) => String(item).toLowerCase()));

  for (const [domain, detail] of Object.entries(externalMap)) {
    if (names.has(String(domain).toLowerCase())) {
      return {
        domain,
        ...(typeof detail === "object" ? detail : { note: String(detail) })
      };
    }
  }

  return null;
}

function activeCertificateProxyHosts(cert, proxyHosts) {
  return certificateAffectedProxyHosts(cert, proxyHosts)
    .filter((host) => host.enabled);
}

function buildOrphanedCertificateIssues(certificateDiscovery, npmDiscovery, config) {
  if (!certificateDiscovery || !certificateDiscovery.enabled) return [];

  const orphaned = [];

  for (const cert of certificateDiscovery.certificates || []) {
    const externalUse = certificateExternalUse(cert, config);
    if (externalUse) continue;

    const activeProxyHosts = activeCertificateProxyHosts(
      cert,
      npmDiscovery && npmDiscovery.proxyHosts ? npmDiscovery.proxyHosts : []
    );

    if (!activeProxyHosts.length) {
      orphaned.push({
        id: cert.id,
        name: cert.name,
        provider: cert.provider,
        domains: cert.domains,
        expiresAt: cert.expiresAt,
        daysRemaining: cert.daysRemaining
      });
    }
  }

  if (!orphaned.length) return [];

  const orphanNames = orphaned
    .slice(0, 5)
    .map((cert) => cert.name)
    .join(", ");

  const more = orphaned.length > 5
    ? `, plus ${orphaned.length - 5} more`
    : "";

  return [
    {
      severity: "low",
      type: "orphaned-certificates",
      title: `${orphaned.length} orphaned NPM certificate(s)`,
      text: `${orphaned.length} certificate(s) exist in NPM but are not used by any active NPM proxy host: ${orphanNames}${more}`,
      count: orphaned.length,
      impact: "Cleanup/config hygiene issue",
      certificates: orphaned,
      examples: `${orphanNames}${more}`
    }
  ];
}

function buildCertificateIssues(certificateDiscovery, npmDiscovery, config) {
  if (!certificateDiscovery || !certificateDiscovery.enabled) return [];

  const thresholds = certificateDiscovery.thresholds || {
    highDays: 7,
    mediumDays: 21,
    lowDays: 45
  };

  const proxyHosts = npmDiscovery && npmDiscovery.proxyHosts
    ? npmDiscovery.proxyHosts
    : [];

  const issues = [];

  for (const cert of certificateDiscovery.certificates || []) {
    const severity = certificateSeverity(cert.daysRemaining, thresholds);
    if (!severity) continue;

    const allMatchedProxyHosts = certificateAffectedProxyHosts(cert, proxyHosts);
    const activeProxyHosts = allMatchedProxyHosts.filter((host) => host.enabled);
    const externalUse = certificateExternalUse(cert, config);

    /*
      Avoid duplicate issue categories:
        - Active NPM certs can be expiration issues.
        - External-use certs can be expiration issues.
        - Certs with no active proxy host and no external-use exception are orphaned only.
    */
    if (!activeProxyHosts.length && !externalUse) {
      continue;
    }

    issues.push({
      severity,
      type: "certificate-expiration",
      title: `Certificate expires: ${cert.name}`,
      text: certificateIssueText(cert, severity),
      count: activeProxyHosts.length,
      impact: activeProxyHosts.length
        ? `${activeProxyHosts.length} active NPM proxy host(s) use this certificate`
        : `Externally used certificate${externalUse && externalUse.note ? `: ${externalUse.note}` : ""}`,
      certificate: {
        id: cert.id,
        name: cert.name,
        provider: cert.provider,
        domains: cert.domains,
        expiresAt: cert.expiresAt,
        daysRemaining: cert.daysRemaining,
        externalUse: externalUse || null
      },
      proxyHosts: activeProxyHosts
    });
  }

  return issues;
}




const dnsDiscoveryCache = {
  domain: null,
  value: null,
  expiresAt: 0,
  promise: null
};

function hostnameFromMaybeUrl(value) {
  const text = String(value || "").trim();
  if (!text) return null;

  try {
    const url = text.startsWith("http://") || text.startsWith("https://")
      ? new URL(text)
      : new URL(`https://${text}`);
    return String(url.hostname || "").toLowerCase().replace(/^www\./, "");
  } catch (err) {
    return null;
  }
}

function simpleRootDomain(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/^www\./, "");
  const parts = host.split(".").filter(Boolean);

  if (parts.length < 2) return null;

  return parts.slice(-2).join(".");
}

function inferPrimaryPublicDomain(model) {
  const counts = new Map();

  function addCandidate(value) {
    const host = hostnameFromMaybeUrl(value);
    const root = simpleRootDomain(host);

    if (!root) return;

    counts.set(root, (counts.get(root) || 0) + 1);
  }

  for (const service of model.services || []) {
    for (const url of service.urls || []) addCandidate(url);
    addCandidate(service.name);
    addCandidate(service.location);
  }

  for (const component of model.components || []) {
    addCandidate(component.name);
    addCandidate(component.subtitle);
  }

  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  return ranked[0] ? ranked[0][0] : null;
}

function inferDnsProviderFromNameservers(nameservers) {
  const joined = (nameservers || []).join(" ").toLowerCase();

  if (joined.includes("cloudflare.com")) return "Cloudflare DNS";
  if (joined.includes("awsdns-")) return "Amazon Route 53 DNS";
  if (joined.includes("domaincontrol.com")) return "GoDaddy DNS";
  if (joined.includes("registrar-servers.com")) return "Namecheap DNS";
  if (joined.includes("googledomains.com") || joined.includes("google.com")) return "Google DNS";
  if (joined.includes("dnsimple.com")) return "DNSimple DNS";
  if (joined.includes("porkbun.com")) return "Porkbun DNS";
  if (joined.includes("squarespacedns.com")) return "Squarespace DNS";
  if (joined.includes("bluehost.com")) return "Bluehost DNS";
  if (joined.includes("linode.com") || joined.includes("akam.net")) return "Akamai / Linode DNS";
  if (joined.includes("ultradns")) return "UltraDNS";

  return "Public DNS Provider";
}

async function discoverPublicDns(model) {
  const domain = inferPrimaryPublicDomain(model);

  if (!domain) {
    return {
      discovered: false,
      domain: null,
      providerLabel: "Public DNS Provider",
      nameservers: [],
      message: "No public domain could be inferred from discovered services."
    };
  }

  const now = Date.now();

  if (
    dnsDiscoveryCache.domain === domain &&
    dnsDiscoveryCache.value &&
    dnsDiscoveryCache.expiresAt > now
  ) {
    return dnsDiscoveryCache.value;
  }

  if (dnsDiscoveryCache.domain === domain && dnsDiscoveryCache.promise) {
    return dnsDiscoveryCache.promise;
  }

  dnsDiscoveryCache.domain = domain;
  dnsDiscoveryCache.promise = (async () => {
    try {
      const nameservers = (await dns.resolveNs(domain))
        .map(item => String(item || "").replace(/\.$/, "").toLowerCase())
        .sort();

      const result = {
        discovered: true,
        domain,
        providerLabel: inferDnsProviderFromNameservers(nameservers),
        nameservers,
        message: `Discovered ${nameservers.length} NS record(s) for ${domain}.`
      };

      dnsDiscoveryCache.value = result;
      dnsDiscoveryCache.expiresAt = Date.now() + (30 * 60 * 1000);
      return result;
    } catch (err) {
      const result = {
        discovered: false,
        domain,
        providerLabel: "Public DNS Provider",
        nameservers: [],
        error: err.message,
        message: `DNS provider discovery failed for ${domain}: ${err.message}`
      };

      dnsDiscoveryCache.value = result;
      dnsDiscoveryCache.expiresAt = Date.now() + (5 * 60 * 1000);
      return result;
    }
  })();

  try {
    return await dnsDiscoveryCache.promise;
  } finally {
    dnsDiscoveryCache.promise = null;
  }
}

function applyDnsDiscoveryToModel(model, dnsDiscovery) {
  const providerLabel = dnsDiscovery && dnsDiscovery.providerLabel
    ? dnsDiscovery.providerLabel
    : "Public DNS Provider";

  return {
    ...model,
    dnsDiscovery,
    dnsProvider: providerLabel,
    primaryDomain: dnsDiscovery ? dnsDiscovery.domain : null,
    components: (model.components || []).map(component => {
      if (component.id !== "cloudflare") return component;

      return {
        ...component,
        name: providerLabel,
        subtitle: dnsDiscovery && dnsDiscovery.domain
          ? dnsDiscovery.domain
          : "Public DNS"
      };
    })
  };
}


const publicWanIpCache = {
  value: null,
  expiresAt: 0,
  promise: null
};

function looksLikeIpAddress(value) {
  const text = String(value || "").trim();

  if (!text || text.length > 80) return false;

  const ipv4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
  const ipv6 = /^[0-9a-fA-F:]+$/;

  return ipv4.test(text) || (text.includes(":") && ipv6.test(text));
}

async function fetchTextWithTimeout(url, timeoutMs = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "ScottiBYTE-BlastRadius/1.0.1"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return String(await response.text()).trim();
  } finally {
    clearTimeout(timer);
  }
}

async function discoverPublicWanIp() {
  const now = Date.now();

  if (publicWanIpCache.value && publicWanIpCache.expiresAt > now) {
    return publicWanIpCache.value;
  }

  if (publicWanIpCache.promise) {
    return publicWanIpCache.promise;
  }

  publicWanIpCache.promise = (async () => {
    const endpoints = [
      "https://ifconfig.me/ip",
      "https://api.ipify.org"
    ];

    for (const endpoint of endpoints) {
      try {
        const value = await fetchTextWithTimeout(endpoint);

        if (looksLikeIpAddress(value)) {
          publicWanIpCache.value = value;
          publicWanIpCache.expiresAt = Date.now() + (10 * 60 * 1000);
          return value;
        }

        console.warn(`WAN IP discovery ignored non-IP response from ${endpoint}`);
      } catch (err) {
        console.warn(`WAN IP discovery failed from ${endpoint}: ${err.message}`);
      }
    }

    publicWanIpCache.value = null;
    publicWanIpCache.expiresAt = Date.now() + (60 * 1000);
    return null;
  })();

  try {
    return await publicWanIpCache.promise;
  } finally {
    publicWanIpCache.promise = null;
  }
}


async function buildLiveModel() {
  const baseModel = readModel();
  const config = readConfig();

  const model = {
    ...baseModel,
    generatedAt: new Date().toISOString(),
    components: ensureCoreComponents(baseModel),
    links: Array.isArray(baseModel.links) ? [...baseModel.links] : [],
    services: Array.isArray(baseModel.services) ? [...baseModel.services] : [],
    issues: Array.isArray(baseModel.issues) ? [...baseModel.issues] : []
  };

  const [npmDiscovery, incusDiscovery, certificateDiscovery] = await Promise.all([
    discoverNpmProxyHosts(),
    discoverIncus(),
    discoverNpmCertificates()
  ]);

  const dockerDiscovery = config.dockerDiscovery && config.dockerDiscovery.enabled
    ? await discoverNestedDocker(incusDiscovery)
    : {
        enabled: false,
        instances: [],
        errors: [],
        summary: {
          totalContainers: 0,
          running: 0,
          stopped: 0,
          unhealthy: 0
        },
        message: "Nested Docker discovery is disabled."
      };

  const liveComponents = model.components.filter(
    (component) =>
      !String(component.id).startsWith("npm-proxy-") &&
      !String(component.id).startsWith("incus-remote-") &&
      !String(component.id).startsWith("incus-instance-") &&
      !String(component.id).startsWith("docker-")
  );

  const liveServices = model.services.filter(
    (service) => !String(service.id).startsWith("svc-npm-")
  );

  const liveIssues = [...model.issues];

  if (incusDiscovery.enabled) {
    const remoteNames = [...new Set(incusDiscovery.instances.map((item) => item.remote))];

    for (const remoteName of remoteNames) {
      liveComponents.push(incusRemoteComponent(remoteName));
    }

    for (const instance of incusDiscovery.instances) {
      liveComponents.push(incusInstanceComponent(instance, dockerDiscovery));

      const nestedDocker = findDockerForInstance(dockerDiscovery, instance);
      if (nestedDocker && nestedDocker.available) {
        for (const container of nestedDocker.containers) {
          liveComponents.push(dockerContainerComponent(instance, container));
        }
      }
    }

    for (const err of incusDiscovery.errors) {
      liveIssues.push({
        severity: "medium",
        text: `Incus discovery issue on ${err.remote}: ${err.error}`
      });
    }
  }

  /*
    Nested Docker discovery is visibility-only. A container not having Docker,
    or Docker being unavailable inside a container, is not a public service outage.
    Keep those details in /api/discovery/docker and model.discovery.docker,
    but do not flood Current Issues with per-instance discovery misses.
  */

  if (npmDiscovery.enabled) {
    const checksById = new Map(npmDiscovery.checks.map((check) => [check.id, check]));

    for (const proxyHost of npmDiscovery.proxyHosts) {
      const check = checksById.get(proxyHost.id);
      const incusOwner = findIncusOwnerByIp(incusDiscovery, proxyHost.forward_host);
      const component = proxyHostToComponent(proxyHost, check, incusOwner);
      const service = proxyHostToService(proxyHost, check, incusOwner);

      liveComponents.push(component);
      liveServices.push(service);

      if (!proxyHost.enabled) {
        liveIssues.push({
          severity: "medium",
          text: `${service.name} is disabled in Nginx Proxy Manager`
        });
      } else if (check && check.checkMode === "skip") {
        // Intentionally ignored by override.
      } else if (check && check.checkMode === "public" && check.publicHttp && check.publicHttp.ok === false) {
        liveIssues.push({
          severity: "high",
          text: `${service.name} public URL check failed at ${check.publicHttp.url} - ${check.publicHttp.message}`
        });
      } else if (check && check.checkMode === "http" && check.http && check.http.ok === false) {
        liveIssues.push({
          severity: "high",
          text: `${service.name} HTTP target check failed at ${check.targetUrl} - ${check.http.message}`
        });
      } else if (check && check.checkMode === "tcp" && check.tcp && check.tcp.ok === false) {
        liveIssues.push({
          severity: "high",
          text: `${service.name} target is unreachable at ${check.forwardHost}:${check.forwardPort} - ${check.tcp.message}`
        });
      }
    }
  }

  if (certificateDiscovery.enabled) {
    liveIssues.push(...buildCertificateIssues(certificateDiscovery, npmDiscovery, config));
    liveIssues.push(...buildOrphanedCertificateIssues(certificateDiscovery, npmDiscovery, config));
  } else if (certificateDiscovery.errors && certificateDiscovery.errors.length) {
    liveIssues.push({
      severity: "low",
      type: "certificate-discovery",
      title: "Certificate discovery unavailable",
      text: certificateDiscovery.message || "NPM certificate discovery failed.",
      impact: "Certificate expiration warnings may be unavailable.",
      errors: certificateDiscovery.errors
    });
  }

  /*
    Stopped Incus instances are infrastructure issues even when public services
    are still healthy. Promote them into Current Issues, but avoid flooding:
      - HIGH if the stopped instance owns one or more public services
      - LOW aggregate count if stopped instances have no public services
  */
  if (incusDiscovery.enabled) {
    const stoppedInstances = incusDiscovery.instances.filter((instance) =>
      String(instance.status || "").toLowerCase() !== "running"
    );

    const stoppedWithPublicServices = [];
    const stoppedWithoutPublicServices = [];

    for (const instance of stoppedInstances) {
      const ownedServices = liveServices.filter((service) =>
        service.incusOwner &&
        service.incusOwner.remote === instance.remote &&
        service.incusOwner.name === instance.name
      );

      if (ownedServices.length) {
        stoppedWithPublicServices.push({
          instance,
          services: ownedServices
        });
      } else {
        stoppedWithoutPublicServices.push(instance);
      }
    }

    for (const item of stoppedWithPublicServices) {
      const serviceNames = item.services
        .map((service) => service.name)
        .slice(0, 5)
        .join(", ");

      const more = item.services.length > 5
        ? `, plus ${item.services.length - 5} more`
        : "";

      liveIssues.push({
        severity: "high",
        type: "stopped-public-service-owner",
        title: `Stopped public service owner: ${item.instance.remote}/${item.instance.name}`,
        text: `Incus instance ${item.instance.remote}/${item.instance.name} is stopped and owns ${item.services.length} public service(s).`,
        count: item.services.length,
        impact: "Public services may be affected",
        instance: {
          remote: item.instance.remote,
          name: item.instance.name,
          type: item.instance.type,
          status: item.instance.status,
          preferredIp: item.instance.preferredIp,
          preferredInterface: item.instance.preferredInterface,
          snapshots: item.instance.snapshots || 0
        },
        services: item.services.map((service) => ({
          name: service.name,
          urls: service.urls || [],
          location: service.location,
          status: service.status
        })),
        examples: `${serviceNames}${more}`
      });
    }

    if (stoppedWithoutPublicServices.length) {
      const examples = stoppedWithoutPublicServices
        .slice(0, 6)
        .map((instance) => `${instance.remote}/${instance.name}`)
        .join(", ");

      const more = stoppedWithoutPublicServices.length > 6
        ? `, plus ${stoppedWithoutPublicServices.length - 6} more`
        : "";

      liveIssues.push({
        severity: "low",
        type: "stopped-incus-instances",
        title: `${stoppedWithoutPublicServices.length} stopped Incus instance(s)`,
        text: `${stoppedWithoutPublicServices.length} Incus instance(s) are stopped with no matched public services.`,
        count: stoppedWithoutPublicServices.length,
        impact: "No matched public services",
        instances: stoppedWithoutPublicServices.map((instance) => ({
          remote: instance.remote,
          name: instance.name,
          type: instance.type,
          status: instance.status,
          preferredIp: instance.preferredIp,
          preferredInterface: instance.preferredInterface,
          snapshots: instance.snapshots || 0
        })),
        examples: `${examples}${more}`
      });
    }
  }

  const liveModel = {
    ...model,
    generatedAt: new Date().toISOString(),
    components: liveComponents,
    services: liveServices,
    issues: liveIssues,
    discovery: {
      npm: {
        enabled: npmDiscovery.enabled,
        proxyHostCount: npmDiscovery.proxyHosts ? npmDiscovery.proxyHosts.length : 0,
        checkedAt: new Date().toISOString()
      },
      incus: {
        enabled: incusDiscovery.enabled,
        instanceCount: incusDiscovery.instances ? incusDiscovery.instances.length : 0,
        errorCount: incusDiscovery.errors ? incusDiscovery.errors.length : 0,
        checkedAt: new Date().toISOString()
      },
      docker: {
        enabled: dockerDiscovery.enabled,
        cached: Boolean(dockerDiscovery.cached),
        scannedInstances: dockerDiscovery.scannedInstances || 0,
        totalEligibleInstances: dockerDiscovery.totalEligibleInstances || 0,
        summary: dockerDiscovery.summary || {},
        checkedAt: dockerDiscovery.checkedAt || null
      },
      certificates: {
        enabled: certificateDiscovery.enabled,
        certificateCount: certificateDiscovery.certificates ? certificateDiscovery.certificates.length : 0,
        errorCount: certificateDiscovery.errors ? certificateDiscovery.errors.length : 0,
        thresholds: certificateDiscovery.thresholds || {},
        checkedAt: new Date().toISOString()
      }
    }
  };

  return {
    model: liveModel,
    npmDiscovery,
    incusDiscovery,
    dockerDiscovery
  };
}

async function getLiveModel(force = false) {
  const config = readConfig();
  const cacheSeconds =
    config.liveModelCache && config.liveModelCache.cacheSeconds
      ? Number(config.liveModelCache.cacheSeconds)
      : 45;

  const cacheValid =
    liveModelCache.data &&
    Date.now() - liveModelCache.createdAt < cacheSeconds * 1000;

  if (!force && cacheValid) {
    return {
      ...liveModelCache.data,
      cached: true
    };
  }

  if (!force && liveModelCache.promise) {
    const result = await liveModelCache.promise;
    return {
      ...result,
      cached: true,
      sharedInFlight: true
    };
  }

  liveModelCache.promise = buildLiveModel()
    .then((result) => {
      liveModelCache.createdAt = Date.now();
      liveModelCache.data = result;
      return result;
    })
    .finally(() => {
      liveModelCache.promise = null;
    });

  const result = await liveModelCache.promise;

  return {
    ...result,
    cached: false
  };
}

function invalidateLiveModelCache() {
  liveModelCache.createdAt = 0;
  liveModelCache.data = null;
  liveModelCache.promise = null;
}

function buildSummary(model) {
  const realNpmProxyComponents = model.components.filter((c) =>
    c.type === "proxy-host" &&
    String(c.id || "").startsWith("npm-proxy-")
  );

  return {
    incusHosts: {
      total: model.components.filter((c) => c.type === "incus-host").length,
      online: model.components.filter((c) => c.type === "incus-host" && c.status === "ok").length
    },
    incusInstances: {
      running: model.components.filter((c) => c.type === "incus-instance" && c.status !== "offline").length,
      stopped: model.components.filter((c) => c.type === "incus-instance" && c.status === "offline").length
    },
    dockerContainers: {
      running: model.components.filter((c) => c.type === "docker-container" && c.status === "ok").length,
      unhealthy: model.components.filter((c) => c.type === "docker-container" && c.status !== "ok").length
    },
    proxyHosts: {
      active: realNpmProxyComponents.filter((c) => c.status === "ok").length,
      broken: realNpmProxyComponents.filter((c) => c.status !== "ok").length
    },
    unifiDevices: {
      online: model.components.filter((c) => c.type === "unifi-device" && c.status === "ok").length,
      offline: model.components.filter((c) => c.type === "unifi-device" && c.status === "offline").length
    },
    publicServices: {
      healthy: model.services.filter((s) => s.status === "healthy").length,
      degraded: model.services.filter((s) => s.status !== "healthy").length
    }
  };
}

function groupIssuesBySeverity(issues) {
  return {
    high: issues.filter((issue) => issue.severity === "high"),
    medium: issues.filter((issue) => issue.severity === "medium"),
    low: issues.filter((issue) => issue.severity === "low")
  };
}

function findProxyHostsByDomain(model, domain) {
  const wanted = String(domain || "").toLowerCase();

  return model.services.filter((service) => {
    const urls = service.urls || [];
    return urls.some((item) => String(item).toLowerCase() === wanted);
  });
}

function findProxyHostsByIp(model, ip) {
  return model.services.filter((service) => {
    return service.npm && service.npm.forwardHost === ip;
  });
}

app.get("/api/config/status", (req, res) => {
  const config = readConfig();

  res.json({
    npm: {
      configured: Boolean(config.npm && config.npm.url && config.npm.email && config.npm.password),
      enabled: Boolean(config.npm && config.npm.enabled),
      url: config.npm ? config.npm.url : null,
      email: config.npm ? config.npm.email : null,
      passwordPresent: Boolean(config.npm && config.npm.password),
      timeoutMs: config.npm ? config.npm.timeoutMs || 5000 : 5000,
      defaultCheckMode: config.npm && config.npm.defaultCheckMode ? config.npm.defaultCheckMode : "tcp",
      domainOverrides: config.npm && config.npm.domainOverrides
        ? Object.keys(config.npm.domainOverrides)
        : []
    },
    incus: {
      configured: Boolean(
        config.incus &&
        config.incus.cert &&
        config.incus.key &&
        Array.isArray(config.incus.remotes)
      ),
      enabled: Boolean(config.incus && config.incus.enabled),
      certPresent: Boolean(config.incus && config.incus.cert && fs.existsSync(resolveAppPath(config.incus.cert))),
      keyPresent: Boolean(config.incus && config.incus.key && fs.existsSync(resolveAppPath(config.incus.key))),
      verifyTls: Boolean(config.incus && config.incus.verifyTls),
      remotes: config.incus && Array.isArray(config.incus.remotes)
        ? config.incus.remotes.map((remote) => ({
            name: remote.name,
            url: remote.url,
            enabled: Boolean(remote.enabled),
            project: remote.project || "default"
          }))
        : []
    },
    dockerDiscovery: {
      configured: Boolean(config.dockerDiscovery),
      enabled: Boolean(config.dockerDiscovery && config.dockerDiscovery.enabled),
      timeoutMs: config.dockerDiscovery ? config.dockerDiscovery.timeoutMs || 8000 : 8000,
      cacheSeconds: config.dockerDiscovery ? config.dockerDiscovery.cacheSeconds || 300 : 300,
      maxInstances: config.dockerDiscovery ? config.dockerDiscovery.maxInstances || 25 : 25
    },
    liveModelCache: {
      configured: true,
      enabled: true,
      cacheSeconds: config.liveModelCache && config.liveModelCache.cacheSeconds
        ? Number(config.liveModelCache.cacheSeconds)
        : 45,
      populated: Boolean(liveModelCache.data),
      inFlight: Boolean(liveModelCache.promise)
    },
    certificateDiscovery: {
      configured: true,
      enabled: certificateDiscoveryConfig(config).enabled,
      highDays: certificateDiscoveryConfig(config).highDays,
      mediumDays: certificateDiscoveryConfig(config).mediumDays,
      lowDays: certificateDiscoveryConfig(config).lowDays,
      externalUseCertificates: config.certificateDiscovery && config.certificateDiscovery.externalUseCertificates
        ? Object.keys(config.certificateDiscovery.externalUseCertificates)
        : []
    }
  });
});

app.get("/api/model", async (req, res) => {
  try {
    const force = req.query.force === "1" || req.query.force === "true";
    const live = await getLiveModel(force);
    const wanIp = await discoverPublicWanIp();
    const dnsDiscovery = await discoverPublicDns(live.model);
    const model = applyDnsDiscoveryToModel(live.model, dnsDiscovery);

    res.json({
      ...model,
      wanIp,
      publicIp: wanIp
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to build live homelab model",
      detail: err.message
    });
  }
});

app.get("/api/summary", async (req, res) => {
  try {
    const force = req.query.force === "1" || req.query.force === "true";
    const live = await getLiveModel(force);
    const wanIp = await discoverPublicWanIp();
    const dnsDiscovery = await discoverPublicDns(live.model);

    res.json({
      ...buildSummary(live.model),
      wanIp,
      publicIp: wanIp,
      dnsDiscovery,
      dnsProvider: dnsDiscovery.providerLabel,
      primaryDomain: dnsDiscovery.domain
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to build summary",
      detail: err.message
    });
  }
});

app.get("/api/issues", async (req, res) => {
  try {
    const force = req.query.force === "1" || req.query.force === "true";
    const live = await getLiveModel(force);
    res.json({
      issues: live.model.issues,
      grouped: groupIssuesBySeverity(live.model.issues)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to build issues",
      detail: err.message
    });
  }
});

app.get("/api/discovery/npm", async (req, res) => {
  try {
    const npmDiscovery = await discoverNpmProxyHosts();
    res.json(npmDiscovery);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "NPM discovery failed",
      detail: err.message
    });
  }
});

app.get("/api/discovery/certificates", async (req, res) => {
  try {
    const certificateDiscovery = await discoverNpmCertificates();
    res.json(certificateDiscovery);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Certificate discovery failed",
      detail: err.message
    });
  }
});

app.get("/api/discovery/incus", async (req, res) => {
  try {
    const incusDiscovery = await discoverIncus();
    res.json(incusDiscovery);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Incus discovery failed",
      detail: err.message
    });
  }
});

app.get("/api/discovery/docker", async (req, res) => {
  try {
    const force = req.query.force === "1" || req.query.force === "true";
    const incusDiscovery = await discoverIncus();
    const dockerDiscovery = await discoverNestedDocker(incusDiscovery, force);

    if (force) {
      invalidateLiveModelCache();
    }

    res.json(dockerDiscovery);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Nested Docker discovery failed",
      detail: err.message
    });
  }
});

app.get("/api/lookup/ip/:ip", async (req, res) => {
  try {
    const force = req.query.force === "1" || req.query.force === "true";
    const live = await getLiveModel(force);
    const ip = req.params.ip;

    const incusOwner = findIncusOwnerByIp(live.incusDiscovery, ip);
    const proxyHosts = findProxyHostsByIp(live.model, ip);

    res.json({
      ip,
      incusOwner,
      proxyHosts,
      proxyHostCount: proxyHosts.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "IP lookup failed",
      detail: err.message
    });
  }
});

app.get("/api/lookup/domain/:domain", async (req, res) => {
  try {
    const force = req.query.force === "1" || req.query.force === "true";
    const live = await getLiveModel(force);
    const domain = req.params.domain;
    const proxyHosts = findProxyHostsByDomain(live.model, domain);

    const enriched = proxyHosts.map((service) => {
      const forwardHost = service.npm ? service.npm.forwardHost : null;
      const incusOwner = forwardHost ? findIncusOwnerByIp(live.incusDiscovery, forwardHost) : null;

      return {
        service,
        forwardHost,
        forwardPort: service.npm ? service.npm.forwardPort : null,
        incusOwner
      };
    });

    res.json({
      domain,
      matches: enriched,
      count: enriched.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Domain lookup failed",
      detail: err.message
    });
  }
});

app.get("/api/broken-paths", async (req, res) => {
  try {
    const [npmDiscovery, incusDiscovery] = await Promise.all([
      discoverNpmProxyHosts(),
      discoverIncus()
    ]);

    if (!npmDiscovery.enabled) {
      return res.json({
        enabled: false,
        brokenPaths: [],
        message: npmDiscovery.message
      });
    }

    const brokenPaths = npmDiscovery.checks
      .filter((check) => isCheckBroken(check))
      .map((check) => {
        let likelyIssue = "Target host or port is unreachable from BlastRadius.";

        if (check.checkMode === "public") {
          likelyIssue = "Public URL check failed.";
        } else if (check.checkMode === "http") {
          likelyIssue = "HTTP target check failed.";
        }

        const incusOwner = findIncusOwnerByIp(incusDiscovery, check.forwardHost);

        return {
          domains: check.domains,
          target: `${check.forwardHost}:${check.forwardPort}`,
          targetUrl: check.targetUrl,
          checkMode: check.checkMode,
          tcp: check.tcp,
          http: check.http,
          publicHttp: check.publicHttp,
          incusOwner,
          likelyIssue
        };
      });

    res.json({
      enabled: true,
      brokenPaths,
      count: brokenPaths.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to calculate broken paths",
      detail: err.message
    });
  }
});

app.get("/api/impact/:componentId", async (req, res) => {
  try {
    const force = req.query.force === "1" || req.query.force === "true";
    const live = await getLiveModel(force);
    const model = live.model;

    const component = findComponent(model, req.params.componentId);
    if (!component) {
      return res.status(404).json({ error: "Component not found" });
    }

    const affected = impactedServices(model, component.id);

    res.json({
      component,
      affectedServices: affected,
      affectedUrls: [...new Set(affected.flatMap((svc) => svc.urls || []))],
      affectedCount: affected.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to calculate impact",
      detail: err.message
    });
  }
});

app.post("/api/simulate", async (req, res) => {
  try {
    const force = req.query.force === "1" || req.query.force === "true";
    const live = await getLiveModel(force);
    const model = live.model;

    const componentId = req.body.componentId;
    const component = findComponent(model, componentId);

    if (!component) {
      return res.status(404).json({ error: "Component not found" });
    }

    const affected = impactedServices(model, componentId);
    const affectedUrls = [...new Set(affected.flatMap((svc) => svc.urls || []))];

    res.json({
      simulatedFailure: component,
      severity: affected.length >= 10
        ? "critical"
        : affected.length >= 5
          ? "high"
          : affected.length >= 2
            ? "medium"
            : "low",
      affectedServices: affected,
      affectedUrls
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to simulate failure",
      detail: err.message
    });
  }
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    app: "ScottiBYTE BlastRadius",
    version: "1.0.1",
    time: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`ScottiBYTE BlastRadius listening on port ${PORT}`);
});
