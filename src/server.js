import { createServer } from 'node:http';
import { handler } from './http.js';

const server = createServer(handler);
server.on('error', () => {
  console.error('Unable to start underwriting service.');
  process.exitCode = 1;
});
server.listen(3000, '127.0.0.1', () => {
  console.log('Underwriting service listening at http://127.0.0.1:3000');
});
