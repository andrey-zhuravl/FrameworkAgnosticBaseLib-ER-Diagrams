import { createServer } from 'http';
import { readFile, stat } from 'fs/promises';
import { extname, join, normalize } from 'path';

const PORT = Number.parseInt(process.env.PORT ?? '8080', 10);
const DEFAULT_FILE = process.env.DEFAULT_FILE ?? 'examples/basic.html';
const ROOT = join(process.cwd(), process.env.STATIC_ROOT ?? '.');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
};

function resolvePath(requestPath) {
  const cleaned = requestPath.replace(/^\/+/, '');
  if (!cleaned) {
    return DEFAULT_FILE;
  }
  return cleaned;
}

async function fileExists(filePath) {
  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      return fileExists(join(filePath, 'index.html'));
    }
    return filePath;
  } catch (error) {
    return null;
  }
}

function getContentType(filePath) {
  const ext = extname(filePath).toLowerCase();
  return mimeTypes[ext] ?? 'application/octet-stream';
}

function isPathWithinRoot(filePath) {
  const normalizedRoot = normalize(ROOT + '/');
  const normalizedPath = normalize(filePath);
  return normalizedPath.startsWith(normalizedRoot);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const resolvedPath = resolvePath(decodeURIComponent(url.pathname));
    const absolutePath = normalize(join(ROOT, resolvedPath));

    if (!isPathWithinRoot(absolutePath)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    const existingFile = await fileExists(absolutePath);
    if (!existingFile) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    const content = await readFile(existingFile);
    res.writeHead(200, {
      'Content-Type': getContentType(existingFile),
      'Cache-Control': 'no-store',
    });
    res.end(content);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error');
    console.error(error);
  }
});

server.listen(PORT, () => {
  console.log(`Static server listening on port ${PORT}`);
  console.log(`Serving files from ${ROOT}`);
  console.log(`Default file: ${DEFAULT_FILE}`);
});
