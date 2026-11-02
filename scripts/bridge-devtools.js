const net = require('net');

const server = net.createServer((socket) => {
  const target = net.connect(9222, '127.0.0.1');
  socket.pipe(target).pipe(socket);
  target.on('error', () => socket.destroy());
  socket.on('error', () => target.destroy());
});

server.listen(9223, '0.0.0.0', () => {
  console.log('DevTools Windows Bridge listening on 0.0.0.0:9223 -> 127.0.0.1:9222');
});
