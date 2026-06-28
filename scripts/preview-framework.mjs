import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const clientRoot = path.resolve("build-framework", "client");
const frameworkFallbackPath = path.join(clientRoot, "__spa-fallback.html");
const notFoundPath = path.join(clientRoot, "404.html");
const requestedPort = Number(process.env.PORT || process.argv[2] || 4176);
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

if (!fs.existsSync(frameworkFallbackPath)) {
  throw new Error("Run npm run build:framework before previewing.");
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url || "/", "http://localhost");
  const requestPath = decodeURIComponent(requestUrl.pathname);
  const { filePath, statusCode } = resolveRequestPath(requestPath);

  response.statusCode = statusCode;
  response.setHeader(
    "Content-Type",
    contentTypes.get(path.extname(filePath).toLowerCase()) ||
      "application/octet-stream"
  );
  fs.createReadStream(filePath).pipe(response);
});

server.listen(requestedPort, "127.0.0.1", () => {
  console.log(`Framework preview: http://127.0.0.1:${requestedPort}`);
});

function resolveRequestPath(requestPath) {
  const relativePath = requestPath.replace(/^\/+/, "");
  const candidates = [
    path.resolve(clientRoot, relativePath),
    path.resolve(clientRoot, relativePath, "index.html"),
  ];

  for (const candidate of candidates) {
    if (
      isInsideClientRoot(candidate) &&
      fs.existsSync(candidate) &&
      fs.statSync(candidate).isFile()
    ) {
      return { filePath: candidate, statusCode: 200 };
    }
  }

  const fallbackPath = fs.existsSync(notFoundPath)
    ? notFoundPath
    : frameworkFallbackPath;

  return {
    filePath: fallbackPath,
    statusCode: fs.existsSync(notFoundPath) ? 404 : 200,
  };
}

function isInsideClientRoot(candidate) {
  const relativePath = path.relative(clientRoot, candidate);

  return !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}
