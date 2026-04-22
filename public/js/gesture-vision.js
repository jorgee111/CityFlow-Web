// public/js/gesture-vision.js
// Implementación local de MediaPipe Hands (sustituye a gestureDaemon.py)

let hands = null;
let camera = null;
let detectorRunning = false;
let lastGestures = [];
const COOLDOWN_MS = 10000; // 10 segundos
let fivePrev = false;

function countFingers(landmarks) {
  let count = 0;
  
  // Pulgar: tip (4) vs mcp (2)
  // Aproximación simple en el eje X (asume mano derecha o pulgar extendido hacia la izquierda)
  if (landmarks[4].x < landmarks[2].x) count++;
  
  // Índice, Corazón, Anular, Meñique: tip vs pip en el eje Y
  const tips = [8, 12, 16, 20];
  tips.forEach(t => {
    if (landmarks[t].y < landmarks[t-2].y) count++;
  });
  
  return count;
}

async function startGestureDetection() {
  if (detectorRunning) return;
  
  const videoElement = document.getElementById('video-feed');
  const canvasElement = document.getElementById('canvas-feed');
  const canvasCtx = canvasElement.getContext('2d');

  // Inicializar MediaPipe si no existe
  if (!hands) {
    hands = new Hands({locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }});

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.5
    });

    hands.onResults((results) => {
      if (!detectorRunning) return;

      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      
      // Dibujar la imagen de la cámara (efecto espejo)
      canvasCtx.translate(canvasElement.width, 0);
      canvasCtx.scale(-1, 1);
      canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
      
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        for (const landmarks of results.multiHandLandmarks) {
          // Dibujar esqueleto (usando las funciones de MediaPipe Drawing Utils)
          drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: '#00FF00', lineWidth: 4});
          drawLandmarks(canvasCtx, landmarks, {color: '#FF0000', lineWidth: 1, radius: 2});
          
          const cnt = countFingers(landmarks);

          // Voltear canvas temporalmente para dibujar el texto sin que esté al revés
          canvasCtx.save();
          canvasCtx.scale(-1, 1);
          canvasCtx.translate(-canvasElement.width, 0);
          canvasCtx.font = "bold 32px 'Space Grotesk', sans-serif";
          canvasCtx.fillStyle = "white";
          canvasCtx.strokeStyle = "black";
          canvasCtx.lineWidth = 3;
          canvasCtx.strokeText("Dedos: " + cnt, 20, 50);
          canvasCtx.fillText("Dedos: " + cnt, 20, 50);
          canvasCtx.restore();

          // Lógica de alerta: 5 dedos, 2 veces en menos de 10s
          if (cnt === 5 && !fivePrev) {
            const t = Date.now();
            lastGestures = lastGestures.filter(x => t - x <= COOLDOWN_MS);
            lastGestures.push(t);
            
            if (lastGestures.length >= 2) {
              sendEmergencyAlert();
              lastGestures = [];
            }
          }
          fivePrev = (cnt === 5);
        }
      } else {
        fivePrev = false; // reset si no hay manos
      }
      canvasCtx.restore();
    });
  }

  if (!camera) {
    camera = new Camera(videoElement, {
      onFrame: async () => {
        if (detectorRunning) {
          // Ajustar tamaño del canvas al del video real
          canvasElement.width = videoElement.videoWidth;
          canvasElement.height = videoElement.videoHeight;
          await hands.send({image: videoElement});
        }
      },
      width: 640,
      height: 480
    });
  }

  detectorRunning = true;
  await camera.start();
}

function stopGestureDetection() {
  detectorRunning = false;
  if (camera) {
    camera.stop();
  }
  
  // Limpiar el lienzo
  const canvasElement = document.getElementById('canvas-feed');
  const canvasCtx = canvasElement.getContext('2d');
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
}

async function sendEmergencyAlert() {
  try {
    // Mandar petición directa a nuestro backend Node.js, quien avisará por SSE a todos
    await api.post('/gestures/alert', { alert: 'double_five', source: 'web_client' });
    console.log('[Gestos] Alerta de emergencia enviada desde el navegador');
  } catch(e) {
    console.error('[Gestos] Error enviando alerta', e);
  }
}
