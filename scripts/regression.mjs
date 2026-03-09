import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "../node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js";
import { StreamableHTTPClientTransport } from "../node_modules/@modelcontextprotocol/sdk/dist/esm/client/streamableHttp.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const host = "127.0.0.1";
const upstreamPort = 39101;
const staticPort = 39102;
const dynamicPort = 39103;
const ssePort = 39104;

function logStep(message) {
  console.log(`- ${message}`);
}

function collectText(result) {
  return (result.content ?? [])
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("\n\n");
}

function assertContains(text, expected, label) {
  assert.ok(
    text.includes(expected),
    `${label} 预期包含：${expected}\n实际内容：\n${text}`,
  );
}

function assertNotContains(text, unexpected, label) {
  assert.ok(
    !text.includes(unexpected),
    `${label} 不应该包含：${unexpected}\n实际内容：\n${text}`,
  );
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function startMockUpstream() {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    const sendJson = (status, body) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };

    if (req.method === "POST" && url.pathname === "/convert/json") {
      const rawBody = await readRequestBody(req);
      let parsedBody;

      try {
        parsedBody = JSON.parse(rawBody || "{}");
      } catch {
        sendJson(400, { message: "请求体不是合法 JSON" });
        return;
      }

      if (parsedBody.content === "quota-test") {
        sendJson(402, {
          message: "访客积分不足，请注册 UapiPro 账号获取更多额度。",
        });
        return;
      }

      if (parsedBody.content === "not-enough-input-test") {
        sendJson(400, {
          message: "not enough input fields",
        });
        return;
      }

      if (parsedBody.content === "uapikey-test") {
        if (req.headers.authorization !== "Bearer public-token") {
          sendJson(401, {
            message: `expected bearer public-token, got: ${req.headers.authorization ?? "missing"}`,
          });
          return;
        }

        sendJson(200, {
          content: "mock-ok:uapikey-test",
        });
        return;
      }

      sendJson(200, {
        content: `mock-ok:${parsedBody.content ?? ""}`,
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/status/ratelimit") {
      if (!req.headers.authorization) {
        sendJson(401, { message: "missing bearer token" });
        return;
      }

      if (req.headers.authorization !== "Bearer admin-token") {
        sendJson(403, {
          message: `expected bearer admin-token, got: ${req.headers.authorization}`,
        });
        return;
      }

      sendJson(200, { ok: true });
      return;
    }

    sendJson(404, {
      message: `mock route not found: ${req.method} ${url.pathname}`,
    });
  });

  server.listen(upstreamPort, host);
  await once(server, "listening");
  return server;
}

async function waitForServerReady(proc, label) {
  const startedPattern = /MCP Streamable HTTP server started|MCP HTTP server started/i;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`${label} 启动超时。`));
    }, 15000);

    const onData = (chunk) => {
      const text = chunk.toString("utf8");
      if (startedPattern.test(text)) {
        cleanup();
        resolve();
      }
    };

    const onExit = (code) => {
      cleanup();
      reject(new Error(`${label} 提前退出，退出码：${code ?? "unknown"}`));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      proc.stdout?.off("data", onData);
      proc.stderr?.off("data", onData);
      proc.off("exit", onExit);
    };

    proc.stdout?.on("data", onData);
    proc.stderr?.on("data", onData);
    proc.on("exit", onExit);
  });
}

function startProcess(args, label) {
  const proc = spawn(process.execPath, ["./bin/mcp-server.js", ...args], {
    cwd: rootDir,
    stdio: ["ignore", "pipe", "pipe"],
  });

  proc.stdout?.setEncoding("utf8");
  proc.stderr?.setEncoding("utf8");
  return { proc, label };
}

async function stopProcess(proc) {
  if (proc.exitCode != null) {
    return;
  }

  proc.kill("SIGTERM");
  const exitPromise = once(proc, "exit").catch(() => undefined);
  const timeoutPromise = delay(5000).then(async () => {
    if (proc.exitCode == null) {
      proc.kill("SIGKILL");
    }
  });

  await Promise.race([exitPromise, timeoutPromise]);
}

async function withProcess(args, label, fn) {
  const { proc } = startProcess(args, label);
  await waitForServerReady(proc, label);

  try {
    return await fn();
  } finally {
    await stopProcess(proc);
  }
}

async function connectStreamableClient(port) {
  const transport = new StreamableHTTPClientTransport(
    new URL(`http://${host}:${port}/mcp`),
  );
  const client = new Client({ name: "regression-client", version: "0.0.1" });
  await client.connect(transport);
  return { client, transport };
}

async function testStaticServer(mockUrl) {
  await withProcess(
    ["serve", "--port", String(staticPort), "--server-url", mockUrl],
    "静态 Streamable HTTP 服务",
    async () => {
      const { client } = await connectStreamableClient(staticPort);

      try {
        logStep("校验公开工具在未传管理员 Token 时也能正常调用");
        const okResult = await client.callTool({
          name: "convert-post-convert-json",
          arguments: {
            request: { content: "{\"hello\":\"world\"}" },
          },
        });
        const okText = collectText(okResult);
        assert.notEqual(okResult.isError, true, "公开工具不应该在本地鉴权阶段失败");
        assertContains(okText, "mock-ok", "公开工具成功响应");

        logStep("校验积分不足时会给出 UapiPro 引导");
        const quotaResult = await client.callTool({
          name: "convert-post-convert-json",
          arguments: {
            request: { content: "quota-test" },
          },
        });
        const quotaText = collectText(quotaResult);
        assert.equal(quotaResult.isError, true, "积分不足应该返回错误结果");
        assertContains(quotaText, "UapiPro", "积分不足引导");
        assertContains(quotaText, "免费获得更多积分", "积分不足引导");
        assertContains(quotaText, "控制台创建 UAPI Key", "积分不足引导");
        assertContains(quotaText, "`uapikey`", "积分不足引导");
        assertContains(quotaText, "继续免费使用", "积分不足引导");
        assertContains(quotaText, "非常便宜", "积分不足引导");
        assertContains(quotaText, "https://uapipro.cn", "积分不足引导");

        logStep("校验 not enough 这类泛化文案不会误判成积分不足");
        const nonQuotaResult = await client.callTool({
          name: "convert-post-convert-json",
          arguments: {
            request: { content: "not-enough-input-test" },
          },
        });
        const nonQuotaText = collectText(nonQuotaResult);
        assert.equal(nonQuotaResult.isError, true, "无效输入应该返回错误");
        assertContains(nonQuotaText, "describe_tool_input", "参数错误提示");
        assertNotContains(nonQuotaText, "UapiPro", "不能误判成积分不足");
        assertNotContains(nonQuotaText, "https://uapipro.cn", "不能误判成积分不足");

        logStep("校验管理员能力会提示 UapiAdminBearerAuth");
        const adminResult = await client.callTool({
          name: "status-get-status-ratelimit",
          arguments: {},
        });
        const adminText = collectText(adminResult);
        assert.equal(adminResult.isError, true, "未传管理员 Token 时应该返回错误");
        assertContains(adminText, "UapiAdminBearerAuth", "管理员鉴权提示");
      } finally {
        await client.close();
      }
    },
  );
}

async function testStaticServerWithUapiKey(mockUrl) {
  await withProcess(
    [
      "serve",
      "--port",
      String(staticPort),
      "--server-url",
      mockUrl,
      "--uapikey",
      "public-token",
    ],
    "带 UAPI Key 的静态 Streamable HTTP 服务",
    async () => {
      const { client } = await connectStreamableClient(staticPort);

      try {
        logStep("校验 uapikey 会自动用于所有公开请求");
        const result = await client.callTool({
          name: "convert-post-convert-json",
          arguments: {
            request: { content: "uapikey-test" },
          },
        });
        const text = collectText(result);
        assert.notEqual(result.isError, true, "配置 uapikey 后公开请求应该成功");
        assertContains(text, "mock-ok:uapikey-test", "uapikey 自动注入");
      } finally {
        await client.close();
      }
    },
  );
}

async function testStaticServerWithAdminBearer(mockUrl) {
  await withProcess(
    [
      "serve",
      "--port",
      String(staticPort),
      "--server-url",
      mockUrl,
      "--uapi-admin-bearer-auth",
      "admin-token",
    ],
    "带管理员 Token 的静态 Streamable HTTP 服务",
    async () => {
      const { client } = await connectStreamableClient(staticPort);

      try {
        logStep("校验管理员 Token 会按 Bearer 形式发给上游");
        const result = await client.callTool({
          name: "status-get-status-ratelimit",
          arguments: {},
        });
        const text = collectText(result);
        assert.notEqual(result.isError, true, "配置管理员 Token 后管理员接口应该成功");
        assertContains(text, "\"ok\": true", "管理员 Bearer 注入");
      } finally {
        await client.close();
      }
    },
  );
}

async function testDynamicServer(mockUrl) {
  await withProcess(
    [
      "serve",
      "--mode",
      "dynamic",
      "--port",
      String(dynamicPort),
      "--server-url",
      mockUrl,
    ],
    "dynamic Streamable HTTP 服务",
    async () => {
      const { client } = await connectStreamableClient(dynamicPort);

      try {
        logStep("校验 execute_tool 参数校验提示");
        const invalidInput = await client.callTool({
          name: "execute_tool",
          arguments: {
            tool_name: "convert-post-convert-json",
            input: {},
          },
        });
        const invalidText = collectText(invalidInput);
        assert.equal(invalidInput.isError, true, "缺少必填参数时应该返回错误");
        assertContains(
          invalidText,
          "Call describe_tool_input",
          "dynamic 参数校验提示",
        );

        logStep("校验 list_tools 只返回短描述，避免撑爆上下文");
        const listedTools = await client.callTool({
          name: "list_tools",
          arguments: {},
        });
        const listedText = collectText(listedTools);
        const listedJson = JSON.parse(listedText);
        assert.ok(Array.isArray(listedJson), "list_tools 应该返回 JSON 数组");
        assert.ok(listedJson.length > 0, "list_tools 不应该返回空数组");

        for (const item of listedJson) {
          assert.equal(typeof item.description, "string", "工具描述应该是字符串");
          assert.ok(
            item.description.length <= 96,
            `工具描述过长：${item.name} => ${item.description.length}`,
          );
          assert.ok(
            !item.description.includes("\n"),
            `工具描述不应该包含换行：${item.name}`,
          );
        }

        logStep("校验 execute_tool 在积分不足时也会给出 UapiPro 引导");
        const quotaResult = await client.callTool({
          name: "execute_tool",
          arguments: {
            tool_name: "convert-post-convert-json",
            input: {
              request: { content: "quota-test" },
            },
          },
        });
        const quotaText = collectText(quotaResult);
        assert.equal(quotaResult.isError, true, "积分不足应该返回错误");
        assertContains(quotaText, "UapiPro", "dynamic 积分不足引导");
        assertContains(quotaText, "免费获得更多积分", "dynamic 积分不足引导");
        assertContains(quotaText, "控制台创建 UAPI Key", "dynamic 积分不足引导");
        assertContains(quotaText, "`uapikey`", "dynamic 积分不足引导");
        assertContains(quotaText, "继续免费使用", "dynamic 积分不足引导");
        assertContains(quotaText, "https://uapipro.cn", "dynamic 积分不足引导");

        logStep("校验 transport 层无效 JSON 会返回可读的 JSON-RPC 错误");
        const invalidJsonResponse = await fetch(`http://${host}:${dynamicPort}/mcp`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: "{\"jsonrpc\":",
        });
        const invalidJsonBody = await invalidJsonResponse.json();
        assert.equal(invalidJsonResponse.status, 400, "无效 JSON 应该返回 400");
        assertContains(
          invalidJsonBody.error.message,
          "请求体不是合法 JSON",
          "transport JSON 解析错误提示",
        );
      } finally {
        await client.close();
      }
    },
  );
}

async function testSSEServer() {
  await withProcess(
    ["start", "--transport", "sse", "--port", String(ssePort)],
    "SSE 服务",
    async () => {
      logStep("校验 SSE 丢失 session 时的友好错误");
      const response = await fetch(`http://${host}:${ssePort}/message/not-found-session`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "ping",
        }),
      });
      const body = await response.json();
      assert.equal(response.status, 404, "缺失 SSE session 应该返回 404");
      assertContains(body.error.message, "当前 SSE 会话不存在", "SSE 会话错误提示");
      assertContains(body.error.message, "重新访问 `/sse`", "SSE 会话错误提示");
    },
  );
}

async function main() {
  const mockServer = await startMockUpstream();
  const mockUrl = `http://${host}:${upstreamPort}`;

  try {
    logStep("开始执行 MCP 回归检查");
    await testStaticServer(mockUrl);
    await testStaticServerWithUapiKey(mockUrl);
    await testStaticServerWithAdminBearer(mockUrl);
    await testDynamicServer(mockUrl);
    await testSSEServer();
    console.log("回归检查全部通过。");
  } finally {
    mockServer.close();
    await once(mockServer, "close");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
