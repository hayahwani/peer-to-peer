
let cam;
let state = 'start';
let recorder = null;
let player;
let previousClipURL = null;
let isRecording = false;

const CLIP_SECONDS = 4;

function setup() {
  createCanvas(windowWidth, windowHeight);
  textAlign(CENTER, CENTER);

  player = document.createElement('video');
  player.setAttribute('playsinline', '');
  player.muted = true;
  player.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;' +
    'object-fit:cover;transform:scaleX(-1);display:none;z-index:10;';
  document.body.appendChild(player);

  socket.on('previous-clip', (videoData) => {
    receiveClip(videoData);
  });

  socket.on('play-clip', (videoData) => {
    receiveClip(videoData);
  });

  socket.on('no-previous-clip', () => {
    console.log('No previous participant yet.');
  });
}

function receiveClip(videoData) {
  const blob = new Blob([videoData.data], {
    type: videoData.mimeType
  });

  const newURL = URL.createObjectURL(blob);

  if (previousClipURL) {
    URL.revokeObjectURL(previousClipURL);
  }

  previousClipURL = newURL;
  console.log('New participant video received!');
}

function draw() {
  background(0);
  fill(255);
  textAlign(CENTER, CENTER);

  if (state === 'start') {
    textSize(26);
    text('Peer to Peer\n\nTap to begin', width / 2, height / 2);
    return;
  }

  if (!cam || !cam.elt.videoWidth) {
    textSize(20);
    text('Starting camera...', width / 2, height / 2);
    return;
  }

  drawCamera();

  if (state === 'camera') {
    textSize(20);
    text('Tap when ready to record', width / 2, height - 50);
  }

  if (state === 'recording') {
    textSize(24);
    text('Recording...', width / 2, height - 50);
  }
}

function mousePressed() {
  if (state === 'start') {
    startCamera();
    socket.emit('request-latest-clip');
    state = 'camera';
  } else if (state === 'camera') {
    startRecording();
  }

  return false;
}

function startCamera() {
  cam = createCapture({
    video: {
      facingMode: 'user',
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: false
  });

  cam.elt.setAttribute('playsinline', '');
  cam.hide();
}

function drawCamera() {
  const iw = cam.elt.videoWidth;
  const ih = cam.elt.videoHeight;
  const s = Math.max(width / iw, height / ih);

  push();
  translate(width / 2, height / 2);
  scale(-1, 1);
  image(cam, -iw * s / 2, -ih * s / 2, iw * s, ih * s);
  pop();
}

function startRecording() {
  if (isRecording) return;

  if (!window.MediaRecorder || !cam.elt.srcObject) {
    alert('Recording is not supported.');
    return;
  }

  const chunks = [];
  const options = { videoBitsPerSecond: 2500000 };

  const formats = [
    'video/mp4',
    'video/webm;codecs=vp8',
    'video/webm'
  ];

  const format = formats.find(f => MediaRecorder.isTypeSupported(f));
  if (format) options.mimeType = format;

  try {
    recorder = new MediaRecorder(cam.elt.srcObject, options);
  } catch (error) {
    alert('Recording failed: ' + error.message);
    return;
  }

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  recorder.onstop = () => {
    const blob = new Blob(chunks, {
      type: recorder.mimeType || 'video/mp4'
    });
	receiveClip({
  data: blob,
  mimeType: blob.type
});

    if (blob.size > 0 && socket.connected) {
      socket.emit('video-clip', {
        data: blob,
        mimeType: blob.type
      });
      console.log('Video sent to server!');
    }

    isRecording = false;
    state = 'camera';
    console.log('Ready for next participant!');
  };

  recorder.onerror = (event) => {
    console.error('Recorder error:', event);
    isRecording = false;
    state = 'camera';
  };

  isRecording = true;
  state = 'recording';

  recorder.start();

  if (previousClipURL) {
    playPreviousClip();
  }

  const currentRecorder = recorder;

  setTimeout(() => {
    if (currentRecorder.state === 'recording') {
      currentRecorder.stop();
    }
  }, CLIP_SECONDS * 1000);
}

player.onended = () => {
  player.pause();
  player.style.display = 'none';
  player.removeAttribute('src');
  player.load();
};

function playPreviousClip() {
  if (!previousClipURL) return;

  player.src = previousClipURL;
  player.currentTime = 0;
  player.style.display = 'block';

  player.play().catch((error) => {
    console.error('Playback failed:', error);
    player.style.display = 'none';
  });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
