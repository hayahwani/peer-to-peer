
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 10e6
});

app.use(express.static('public'));
let latestClip = null;

io.on('connection', (socket) => {
  console.log('Device connected:', socket.id);
	  socket.on('request-latest-clip', () => {
    if (latestClip) {
      socket.emit('previous-clip', latestClip);
    } else {
      socket.emit('no-previous-clip');
    }
  });

  socket.on('video-clip', (videoData) => {
    console.log('Video received from phone');
	latestClip = videoData;

    // Forward the clip to other connected devices
    socket.broadcast.emit('play-clip', videoData);
  });

  socket.on('disconnect', () => {
    console.log('Device disconnected:', socket.id);
  });
});

server.listen(3000, '0.0.0.0', () => {
  console.log('Peer to Peer server running on port 3000');
});
