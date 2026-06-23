/* eslint-env worker */
/* eslint-disable no-restricted-globals */

let cvReadyPromise = null;

const workerScope = self;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    try {
      if (typeof workerScope.importScripts !== 'function') {
        reject(new Error('Este navegador no permite cargar OpenCV en segundo plano.'));
        return;
      }

      workerScope.importScripts(src);
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
      if (workerScope.cv && workerScope.cv.Mat) {
        resolve(workerScope.cv);
        return;
      }

      if (workerScope.cv && typeof workerScope.cv.onRuntimeInitialized !== 'undefined') {
        workerScope.cv.onRuntimeInitialized = () => resolve(workerScope.cv);
        return;
      }

      if (Date.now() - startedAt >= timeout) {
        reject(new Error('Tiempo agotado cargando OpenCV.'));
        return;
      }

      workerScope.setTimeout(check, 100);
    };

    check();
  });
}

async function loadOpenCv(src) {
  if (workerScope.cv && workerScope.cv.Mat) {
    return workerScope.cv;
  }

  if (cvReadyPromise) {
    return cvReadyPromise;
  }

  cvReadyPromise = loadScript(src)
    .then(() => waitForOpenCv())
    .catch((error) => {
      cvReadyPromise = null;
      throw error;
    });

  return cvReadyPromise;
}

function createCanvas(width, height) {
  if (typeof workerScope.OffscreenCanvas === 'undefined') {
    throw new Error('Este navegador no soporta escaneo avanzado en segundo plano.');
  }

  return new workerScope.OffscreenCanvas(width, height);
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

    return dst.clone();
  } finally {
    srcTri.delete();
    dstTri.delete();
    matrix.delete();
    dst.delete();
  }
}

function matToImageData(mat) {
  return new workerScope.ImageData(
    new Uint8ClampedArray(mat.data),
    mat.cols,
    mat.rows
  );
}

function enhanceImageData(imageData, mode = 'natural') {
  const data = imageData.data;

  let brightness = 1.04;
  let contrast = 1.06;
  let saturation = 0.9;

  if (mode === 'clean') {
    brightness = 1.1;
    contrast = 1.12;
    saturation = 0.55;
  }

  if (mode === 'bn') {
    brightness = 1.08;
    contrast = 1.16;
    saturation = 0;
  }

  const contrastFactor = contrast;
  const intercept = 128 * (1 - contrastFactor);

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] * brightness;
    let g = data[i + 1] * brightness;
    let b = data[i + 2] * brightness;

    r = r * contrastFactor + intercept;
    g = g * contrastFactor + intercept;
    b = b * contrastFactor + intercept;

    const luma = 0.299 * r + 0.587 * g + 0.114 * b;

    if (mode === 'bn') {
      const value = luma >= 164 ? 255 : 0;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      continue;
    }

    data[i] = Math.max(0, Math.min(255, luma + (r - luma) * saturation));
    data[i + 1] = Math.max(0, Math.min(255, luma + (g - luma) * saturation));
    data[i + 2] = Math.max(0, Math.min(255, luma + (b - luma) * saturation));
  }

  return imageData;
}

function imageDataToCanvas(imageData) {
  const canvas = createCanvas(imageData.width, imageData.height);
  const ctx = canvas.getContext('2d');

  ctx.putImageData(imageData, 0, 0);

  return canvas;
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

async function createMatFromFile(cv, file, options = {}) {
  if (typeof workerScope.createImageBitmap !== 'function') {
    throw new Error('Este navegador no soporta lectura avanzada de imagen.');
  }

  const imageBitmap = await workerScope.createImageBitmap(file);
  const maxInputSize = options.maxInputSize || 1600;
  const ratio = Math.min(1, maxInputSize / Math.max(imageBitmap.width, imageBitmap.height));
  const width = Math.max(1, Math.round(imageBitmap.width * ratio));
  const height = Math.max(1, Math.round(imageBitmap.height * ratio));
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(imageBitmap, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);

  imageBitmap.close();

  return cv.matFromImageData(imageData);
}

async function scanFile(file, options = {}) {
  const cv = await loadOpenCv(options.opencvSrc || '/opencv/opencv.js');
  const src = await createMatFromFile(cv, file, options);

  let outputMat = null;

  try {
    const points = detectDocumentPoints(cv, src, options);
    let method = 'original';
    let documentDetected = false;

    if (points) {
      outputMat = warpDocument(cv, src, points);
      method = 'perspective';
      documentDetected = true;
    } else {
      outputMat = src.clone();
    }

    const imageData = enhanceImageData(
      matToImageData(outputMat),
      options.mode || 'natural'
    );

    const outputCanvas = resizeCanvas(
      imageDataToCanvas(imageData),
      options
    );

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

    if (outputMat) {
      outputMat.delete();
    }
  }
}

workerScope.onmessage = async (event) => {
  const { id, file, options } = event.data || {};

  try {
    if (!id || !file) {
      throw new Error('No se recibió imagen para escanear.');
    }

    const result = await scanFile(file, options || {});

    workerScope.postMessage({
      id,
      ok: true,
      result
    });
  } catch (error) {
    workerScope.postMessage({
      id,
      ok: false,
      error: error.message || 'No se pudo escanear el acta.'
    });
  }
};