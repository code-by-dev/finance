const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0:3000'; // Bind to all interfaces
const port = parseInt(process.env.PORT, 10) || 3000;

console.log(`Starting server in ${dev ? 'development' : 'production'} mode`);
console.log(`Hostname: ${hostname}`);
console.log(`Port: ${port}`);

// Prepare the Next.js app - don't pass hostname and port to Next.js app
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  console.log('Next.js app prepared, creating HTTP server...');
  
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  })
    .once('error', (err) => {
      console.error('Server error:', err);
      process.exit(1);
    })
    .listen(port, hostname, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Environment: ${process.env.NODE_ENV}`);
      console.log(`> Port from env: ${process.env.PORT}`);
    });
}).catch((err) => {
  console.error('Failed to prepare Next.js app:', err);
  process.exit(1);
});

