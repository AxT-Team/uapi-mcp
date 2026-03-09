# Uapi Mcp

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Docs](https://img.shields.io/badge/Docs-uapis.cn-2EAE5D?style=flat-square)](https://uapis.cn/docs)
[![MCP](https://img.shields.io/badge/MCP-Uapi%20Mcp-7C3AED?style=flat-square)](https://modelcontextprotocol.io/)

Uapi Mcp 是 `uapis.cn` 的官方 MCP Server，用来把 UAPI 的搜索、翻译、图像、文本处理和网页解析能力整理成统一入口，方便接入支持 MCP 的客户端。

## 快速开始

### 方式一：直接安装资源包

如果您希望尽快装好并开始使用，最省事的方式是直接下载已经打包好的 `mcp-server.mcpb`：

- 最新下载地址：`https://github.com/AxT-Team/uapi-mcp/releases/latest/download/mcp-server.mcpb`
- 安装完成后，在资源包配置里填写 `uapikey`
- 如果后面需要管理员范围工具，再补 `UapiAdminBearerAuth`

这种方式不需要您自己手动构建，也不需要额外整理命令行参数。

### 方式二：从源码运行

如果您准备自己修改、调试或者二次打包，可以直接从源码运行。

#### 环境要求

- Node.js 18 或更高版本
- npm
- 首次构建会自动安装并使用 Bun

#### 安装依赖

```bash
npm install
```

#### 构建

```bash
npm run build
```

#### 启动本地 stdio 服务

如果客户端可以直接拉起本地 MCP 进程，建议这样启动：

```bash
node ./bin/mcp-server.js start --mode dynamic
```

#### 启动 Streamable HTTP 服务

如果客户端可以直接连接远程 MCP URL，建议这样启动：

```bash
node ./bin/mcp-server.js serve --mode dynamic --port 39002
```

启动后入口地址是：

```text
http://127.0.0.1:39002/mcp
```

#### 启动 SSE 服务

如果客户端仍然依赖 SSE，可以这样启动：

```bash
node ./bin/mcp-server.js start --transport sse --mode dynamic --port 39001
```

启动后可以访问：

- 首页：`http://127.0.0.1:39001/`
- SSE：`http://127.0.0.1:39001/sse`

## 客户端配置

### 通用本地配置

下面这份配置适合大多数可以本地拉起 MCP 进程的客户端。请把路径改成您自己的实际目录。

```json
{
  "mcpServers": {
    "Uapi Mcp": {
      "command": "node",
      "args": [
        "C:/path/to/uapi-mcp/bin/mcp-server.js",
        "start",
        "--mode",
        "dynamic"
      ],
      "env": {
        "UAPI_MCP_UAPIKEY": "YOUR_UAPI_KEY"
      }
    }
  }
}
```

### Codex 通过 HTTP 连接

如果您已经把服务跑在本机 `39002` 端口，可以这样配置：

```toml
[mcp_servers."Uapi Mcp"]
url = "http://127.0.0.1:39002/mcp"
http_headers = { "UapiKey" = "YOUR_UAPI_KEY" }
```

如果还需要管理员范围工具，再加上管理员 Token：

```toml
[mcp_servers."Uapi Mcp"]
url = "http://127.0.0.1:39002/mcp"
http_headers = { "UapiKey" = "YOUR_UAPI_KEY", "UapiAdminBearerAuth" = "YOUR_ADMIN_TOKEN" }
```

### MCP Bundle

如果您想安装资源包，可以先执行：

```bash
npm run mcpb:build
```

执行完成后会生成：

```text
./mcp-server.mcpb
```

这个包已经内置了 `user_config.uapikey`。安装时把自己的 Key 填进去即可。

## 配置项

### `uapikey`

`uapikey` 会用于所有上游请求，适合公开工具和日常使用场景。您可以通过下面几种方式配置：

- 命令行参数：`--uapikey YOUR_UAPI_KEY`
- 环境变量：`UAPI_MCP_UAPIKEY=YOUR_UAPI_KEY`
- HTTP 请求头：`UapiKey: YOUR_UAPI_KEY`
- MCP Bundle：`user_config.uapikey`

服务端会把它统一转换成上游的：

```text
Authorization: Bearer YOUR_UAPI_KEY
```

### `UapiAdminBearerAuth`

`UapiAdminBearerAuth` 只在管理员范围工具里需要。您可以通过下面几种方式配置：

- 命令行参数：`--uapi-admin-bearer-auth YOUR_ADMIN_TOKEN`
- 环境变量：`UAPI_MCP_UAPI_ADMIN_BEARER_AUTH=YOUR_ADMIN_TOKEN`
- HTTP 请求头：`UapiAdminBearerAuth: YOUR_ADMIN_TOKEN`

服务端同样会把它转换成上游的：

```text
Authorization: Bearer YOUR_ADMIN_TOKEN
```

如果 `uapikey` 和 `UapiAdminBearerAuth` 同时存在，管理员 Token 会优先生效。

## 运行模式

默认建议使用 `dynamic` 模式。这个模式不会在连接建立时一次性暴露全部业务工具，而是先提供 4 个元工具：

- `list_tools`
- `describe_tool_input`
- `execute_tool`
- `list_scopes`

对于工具数量比较多的服务，这种方式更省上下文，也更容易让模型按需调用。

## 常见问题

### 公开工具需要配什么

大多数情况下，只配 `uapikey` 就够用了。

### 访客额度用完怎么办

如果访客额度或免费积分用完了，可以先注册 `UapiPro`：`https://uapipro.cn`。注册完成后，到 `UapiPro` 控制台创建 `UAPI Key`，再把这个 Key 填到 MCP 客户端或者资源包里的 `uapikey` 配置里，就可以继续使用。

### 管理员工具需要配什么

管理员范围工具需要额外传 `UapiAdminBearerAuth`。如果没有这个配置，服务端会直接返回可读的错误提示。

## 常用命令

查看 CLI 帮助：

```bash
node ./bin/mcp-server.js --help
```

只启动公开只读工具：

```bash
node ./bin/mcp-server.js serve --mode dynamic --scope read
```

只启动管理员工具：

```bash
node ./bin/mcp-server.js serve --mode dynamic --scope admin --uapi-admin-bearer-auth YOUR_ADMIN_TOKEN
```

运行回归检查：

```bash
npm run test:regression
```

打包 MCP Bundle：

```bash
npm run mcpb:build
```

## 生成方式

这个项目基于 Speakeasy 的 `mcp-typescript` 生成器构建，输入来自当前仓库的 `openapi.yaml`，并通过 `overlay.yaml` 补充 MCP 相关的作用域、鉴权和描述信息。

- 源规范：`./openapi.yaml`
- MCP 覆盖层：`./overlay.yaml`
- 工作流：`./.speakeasy/workflow.yaml`

如果您需要重新生成，可以执行：

```bash
..\.tools\speakeasy\speakeasy.exe run -t uapi-mcp --output console --skip-upload-spec --skip-versioning
```

## 文档

接口文档请查看 [uapis.cn](https://uapis.cn/docs)。
