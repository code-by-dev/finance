const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
<<<<<<< HEAD
const hostname = '0.0.0.0'; // Bind to all interfaces
const port = parseInt(process.env.PORT) || 3000;

console.log(`Starting server with NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`Port: ${port}, Hostname: ${hostname}`);
=======
const hostname = '0.0.0.0:3000'; // Bind to all interfaces
const port = parseInt(process.env.PORT, 10) || 3000;
>>>>>>> dc81b113add6f71dd92c5c60f05d7ec14dc261e0

console.log(`Starting server in ${dev ? 'development' : 'production'} mode`);
console.log(`Hostname: ${hostname}`);
console.log(`Port: ${port}`);

// Prepare the Next.js app - don't pass hostname and port to Next.js app
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
<<<<<<< HEAD
  console.log('Next.js app prepared successfully');
  
  const server = createServer(async (req, res) => {
=======
  console.log('Next.js app prepared, creating HTTP server...');
  
  createServer(async (req, res) => {
>>>>>>> dc81b113add6f71dd92c5c60f05d7ec14dc261e0
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
<<<<<<< HEAD
  });

  server.once('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
  });

  server.listen(port, hostname, () => {
    console.log(`> Server ready on http://${hostname}:${port}`);
    console.log(`> Local: http://localhost:${port}`);
    console.log(`> Environment: ${process.env.NODE_ENV}`);
  });
}).catch((err) => {
  console.error('Error preparing Next.js app:', err);
=======
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
>>>>>>> dc81b113add6f71dd92c5c60f05d7ec14dc261e0
  process.exit(1);
});

