let cvReadyPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    try {
      const script = self.document?.createElement?.('script');

      if (script) {
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        self.document.body.appendChild(script);
        return;
      }

      importScripts(src);
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

function waitForOpenCv(timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const check = () => {
      if (self.cv && self.cv.Mat) {
        resolve(self.cv);
        return;
      }

      if (self.cv && typeof self.cv.onRuntimeInitialized !== 'undefined') {
        self.cv.onRuntimeInitialized = () => resolve(self.cv);
        return;
      }

      if (Date.now() - startedAt >= timeout) {
        reject(new Error('Tiempo agotado cargando OpenCV.'));
        return;
      }

      setTimeout(check, 100);
    };

    check();
  });
}

async function loadOpenCv(src) {
  if (self.cv && self.cv.Mat) {
    return self.cv;
  }

  if (cvReadyPromise) {
    return cvReadyPromise;
  }

  cvReadyPromise = new Promise(async (resolve, reject) => {
    try {
      await loadScript(src);
      const cv = await waitForOpenCv();
      resolve(cv);
    } catch (error) {
      cvReadyPromise = null;
      reject(error);
    }
  });

  return cvReadyPromise;
}

function createCanvas(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }

  throw new Error('Este navegador no soporta escaneo avanzado en segundo plano.');
}

function orderPoints(points) {
  const cloned = points.map((p) => ({
    x: Number(p.x),
    y: Number(p.y)
  }));

  const bySum = [...cloned].sort((a, b) => (a.x + a.y) - (b.x + b.y));
  const byDiff = [...cloned].sort((a, b) => (a.x - a.y) - (b.x - b.y));

  return [
    bySum[0],
    byDiff[0],
    bySum[bySum.length - 1],
    byDiff[byDiff.length - 1]
  ];
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function polygonArea(points) {
  let area = 0;

  for (let i = 0; i < points.length; i += 1) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }

  return Math.abs(area / 2);
}

function pointsFromMat(mat) {
  const points = [];

  for (let i = 0; i < mat.rows; i += 1) {
    points.push({
      x: mat.data32S[i * 2],
      y: mat.data32S[i * 2 + 1]
    });
  }

  return points;
}

function isUsableDocument(points, width, height) {
  if (!Array.isArray(points) || points.length !== 4) return false;

  const ordered = orderPoints(points);
  const docWidth = Math.max(
    distance(ordered[0], ordered[1]),
    distance(ordered[3], ordered[2])
  );
  const docHeight = Math.max(
    distance(ordered[0], ordered[3]),
    distance(ordered[1], ordered[2])
  );

  if (docWidth < width * 0.25 || docHeight < height * 0.25) return false;

  const area = polygonArea(ordered);
  const imageArea = width * height;

  return area / imageArea >= 0.16;
}

function detectDocumentPoints(cv, src, options = {}) {
  const minAreaRatio = options.minAreaRatio || 0.18;
  const cannyLow = options.cannyLow || 50;
  const cannyHigh = options.cannyHigh || 150;

  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const edges = new cv.Mat();
  const dilated = new cv.Mat();
  const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();

  let bestPoints = null;
  let bestArea = 0;

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
    cv.Canny(blurred, edges, cannyLow, cannyHigh);
    cv.dilate(edges, dilated, kernel);
    cv.findContours(dilated, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const imageArea = src.cols * src.rows;
    const epsilons = [0.018, 0.024, 0.032, 0.045, 0.06];

    for (let i = 0; i < contours.size(); i += 1) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);

      if (area < imageArea * minAreaRatio) {
        contour.delete();
        continue;
      }

      const perimeter = cv.arcLength(contour, true);

      for (const epsilonFactor of epsilons) {
        const approx = new cv.Mat();

        cv.approxPolyDP(contour, approx, epsilonFactor * perimeter, true);

        if (approx.rows === 4 && area > bestArea) {
          const points = pointsFromMat(approx);

          if (isUsableDocument(points, src.cols, src.rows)) {
            bestPoints = points;
            bestArea = area;
          }
        }

        approx.delete();
      }

      contour.delete();
    }

    return bestPoints ? orderPoints(bestPoints) : null;
  } finally {
    gray.delete();
    blurred.delete();
    edges.delete();
    dilated.delete();
    kernel.delete();
    contours.delete();
    hierarchy.delete();
  }
}

function warpDocument(cv, src, points) {
  const ordered = orderPoints(points);
  const widthTop = distance(ordered[0], ordered[1]);
  const widthBottom = distance(ordered[3], ordered[2]);
  const heightLeft = distance(ordered[0], ordered[3]);
  const heightRight = distance(ordered[1], ordered[2]);

  const targetWidth = Math.max(1, Math.round(Math.max(widthTop, widthBottom)));
  const targetHeight = Math.max(1, Math.round(Math.max(heightLeft, heightRight)));

  const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    ordered[0].x, ordered[0].y,
    ordered[1].x, ordered[1].y,
    ordered[2].x, ordered[2].y,
    ordered[3].x, ordered[3].y
  ]);

  const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0, 0,
    targetWidth - 1, 0,
    targetWidth - 1, targetHeight - 1,
    0, targetHeight - 1
  ]);

  const matrix = cv.getPerspectiveTransform(srcTri, dstTri);
  const dst = new cv.Mat();

  try {
    cv.warpPerspective(
      src,
      dst,
      matrix,
      new cv.Size(targetWidth, targetHeight),
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT,
      new cv.Scalar(255, 255, 255, 255)
    );

    const canvas = createCanvas(targetWidth, targetHeight);
    cv.imshow(canvas, dst);

    return canvas;
  } finally {
    srcTri.delete();
    dstTri.delete();
    matrix.delete();
    dst.delete();
  }
}

function enhanceCanvas(canvas, options = {}) {
  const mode = options.mode || 'natural';
  const output = createCanvas(canvas.width, canvas.height);
  const ctx = output.getContext('2d');

  if (mode === 'clean') {
    ctx.filter = 'brightness(1.1) contrast(1.12) saturate(0.55)';
  } else if (mode === 'bn') {
    ctx.filter = 'grayscale(1) brightness(1.08) contrast(1.16)';
  } else {
    ctx.filter = 'brightness(1.04) contrast(1.06) saturate(0.9)';
  }

  ctx.drawImage(canvas, 0, 0);
  ctx.filter = 'none';

  return output;
}

function resizeCanvas(canvas, options = {}) {
  const maxWidth = options.maxWidth || 1800;
  const maxHeight = options.maxHeight || 2400;
  const ratio = Math.min(1, maxWidth / canvas.width, maxHeight / canvas.height);

  if (ratio >= 1) {
    return canvas;
  }

  const output = createCanvas(
    Math.max(1, Math.round(canvas.width * ratio)),
    Math.max(1, Math.round(canvas.height * ratio))
  );

  const ctx = output.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, output.width, output.height);

  return output;
}

async function scanImageBitmap(imageBitmap, options = {}) {
  const cv = await loadOpenCv(options.opencvSrc || '/opencv/opencv.js');

  const maxInputSize = options.maxInputSize || 1800;
  const ratio = Math.min(1, maxInputSize / Math.max(imageBitmap.width, imageBitmap.height));
  const inputCanvas = createCanvas(
    Math.max(1, Math.round(imageBitmap.width * ratio)),
    Math.max(1, Math.round(imageBitmap.height * ratio))
  );

  const inputCtx = inputCanvas.getContext('2d');
  inputCtx.imageSmoothingEnabled = true;
  inputCtx.imageSmoothingQuality = 'high';
  inputCtx.drawImage(imageBitmap, 0, 0, inputCanvas.width, inputCanvas.height);

  const src = cv.imread(inputCanvas);

  try {
    const points = detectDocumentPoints(cv, src, options);
    let outputCanvas = inputCanvas;
    let method = 'original';
    let documentDetected = false;

    if (points) {
      outputCanvas = warpDocument(cv, src, points);
      method = 'perspective';
      documentDetected = true;
    }

    outputCanvas = enhanceCanvas(outputCanvas, options);
    outputCanvas = resizeCanvas(outputCanvas, options);

    const blob = await outputCanvas.convertToBlob({
      type: 'image/jpeg',
      quality: typeof options.quality === 'number' ? options.quality : 0.92
    });

    return {
      blob,
      method,
      documentDetected,
      width: outputCanvas.width,
      height: outputCanvas.height
    };
  } finally {
    src.delete();
    imageBitmap.close();
  }
}

self.onmessage = async (event) => {
  const { id, file, options } = event.data || {};

  try {
    if (!id || !file) {
      throw new Error('No se recibió imagen para escanear.');
    }

    const imageBitmap = await createImageBitmap(file);
    const result = await scanImageBitmap(imageBitmap, options || {});

    self.postMessage({
      id,
      ok: true,
      result
    });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error.message || 'No se pudo escanear el acta.'
    });
  }
};