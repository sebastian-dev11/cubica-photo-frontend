/* eslint-env worker */
/* eslint-disable no-restricted-globals */

let cvReadyPromise = null;

const workerScope = self;

function postProgress(id, step, detail) {
  if (!id) return;

  workerScope.postMessage({
    id,
    type: 'progress',
    step,
    detail: detail || ''
  });
}

function getBasePath(src) {
  return String(src || '/opencv/opencv.js').replace(/\/[^/]*$/, '/');
}

function locateOpenCvFile(src, path) {
  return getBasePath(src) + path;
}

function crearOpcionesOpenCv(src) {
  return {
    locateFile: function (path) {
      return locateOpenCvFile(src, path);
    },
    print: function () {},
    printErr: function () {}
  };
}

function describirOpenCv() {
  if (!workerScope.cv) return 'cv_no_existe';
  if (workerScope.cv && workerScope.cv.Mat) return 'cv_listo';
  if (typeof workerScope.cv === 'function') return 'cv_funcion';
  if (workerScope.cv && workerScope.cv.ready) return 'cv_ready_promise';
  if (workerScope.cv && typeof workerScope.cv.then === 'function') return 'cv_promesa';
  return typeof workerScope.cv;
}

function esperarConLimite(promise, timeout, mensaje) {
  return new Promise(function (resolve, reject) {
    const timer = workerScope.setTimeout(function () {
      reject(new Error(mensaje));
    }, timeout);

    Promise.resolve(promise)
      .then(function (result) {
        workerScope.clearTimeout(timer);
        resolve(result);
      })
      .catch(function (error) {
        workerScope.clearTimeout(timer);
        reject(error);
      });
  });
}

function loadScript(src, id) {
  return new Promise(function (resolve, reject) {
    try {
      if (typeof workerScope.importScripts !== 'function') {
        reject(new Error('Este navegador no permite cargar OpenCV en segundo plano.'));
        return;
      }

      postProgress(id, 'cargando_opencv', src);

      workerScope.Module = crearOpcionesOpenCv(src);
      workerScope.importScripts(src);

      postProgress(id, 'opencv_script_cargado', describirOpenCv());

      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

async function prepararOpenCv(src, id) {
  let cv = workerScope.cv;

  if (!cv) {
    return null;
  }

  if (cv.default) {
    cv = cv.default;
  }

  if (cv && typeof cv.then === 'function') {
    postProgress(id, 'opencv_promesa_detectada', 'se usara fallback');
    throw new Error('OpenCV quedo como promesa pendiente. Se usara escaneo basico.');
  }

  if (cv && cv.Mat) {
    workerScope.cv = cv;
    return cv;
  }

  if (typeof cv === 'function' && !cv.Mat) {
    postProgress(id, 'inicializando_opencv_funcion', 'factory');

    let inicializado = cv(crearOpcionesOpenCv(src));

    workerScope.cv = inicializado;

    if (inicializado && typeof inicializado.then === 'function') {
      postProgress(id, 'opencv_factory_promesa_detectada', 'se usara fallback');
      throw new Error('OpenCV factory quedo como promesa pendiente. Se usara escaneo basico.');
    }

    if (inicializado && inicializado.default) {
      inicializado = inicializado.default;
    }

    if (inicializado && inicializado.ready && typeof inicializado.ready.then === 'function') {
      postProgress(id, 'esperando_opencv_ready', 'ready');

      await esperarConLimite(
        inicializado.ready,
        12000,
        'OpenCV ready no respondio. Se usara escaneo basico.'
      );
    }

    workerScope.cv = inicializado;
    return inicializado;
  }

  if (cv && cv.ready && typeof cv.ready.then === 'function') {
    postProgress(id, 'esperando_opencv_ready', 'ready');

    await esperarConLimite(
      cv.ready,
      12000,
      'OpenCV ready no respondio. Se usara escaneo basico.'
    );

    if (cv.Mat) {
      workerScope.cv = cv;
      return cv;
    }
  }

  workerScope.cv = cv;
  return cv;
}

function waitForOpenCv(src, timeout, id) {
  const limite = timeout || 45000;

  return new Promise(function (resolve, reject) {
    const startedAt = Date.now();
    let lastReport = 0;

    const check = async function () {
      try {
        const cv = await prepararOpenCv(src, id);

        if (cv && cv.Mat) {
          postProgress(id, 'opencv_listo', 'cv.Mat disponible');
          resolve(cv);
          return;
        }

        if (cv && typeof cv.onRuntimeInitialized !== 'undefined') {
          postProgress(id, 'esperando_runtime_opencv', 'onRuntimeInitialized');

          cv.onRuntimeInitialized = function () {
            postProgress(id, 'opencv_listo', 'runtime inicializado');
            resolve(cv);
          };

          return;
        }

        const elapsed = Date.now() - startedAt;

        if (elapsed - lastReport >= 5000) {
          lastReport = elapsed;
          postProgress(id, 'esperando_opencv', describirOpenCv());
        }

        if (elapsed >= limite) {
          reject(new Error(`Tiempo agotado inicializando OpenCV. Estado: ${describirOpenCv()}`));
          return;
        }

        workerScope.setTimeout(check, 100);
      } catch (error) {
        reject(error);
      }
    };

    check();
  });
}

async function loadOpenCv(src, id) {
  if (workerScope.cv && workerScope.cv.Mat) {
    postProgress(id, 'opencv_reutilizado', 'cv.Mat disponible');
    return workerScope.cv;
  }

  if (cvReadyPromise) {
    return cvReadyPromise;
  }

  cvReadyPromise = loadScript(src, id)
    .then(function () {
      return waitForOpenCv(src, 45000, id);
    })
    .catch(function (error) {
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

function enhanceImageData(imageData, mode) {
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

function resizeCanvas(canvas, options) {
  const config = options || {};
  const maxWidth = config.maxWidth || 1400;
  const maxHeight = config.maxHeight || 2000;
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

function orderPoints(points) {
  const cloned = points.map(function (p) {
    return {
      x: Number(p.x),
      y: Number(p.y)
    };
  });

  const bySum = cloned.slice().sort(function (a, b) {
    return a.x + a.y - (b.x + b.y);
  });

  const byDiff = cloned.slice().sort(function (a, b) {
    return a.x - a.y - (b.x - b.y);
  });

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

function detectDocumentPoints(cv, src, options) {
  const config = options || {};
  const minAreaRatio = config.minAreaRatio || 0.12;
  const cannyLow = config.cannyLow || 40;
  const cannyHigh = config.cannyHigh || 120;

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

      for (let e = 0; e < epsilons.length; e += 1) {
        const approx = new cv.Mat();

        cv.approxPolyDP(contour, approx, epsilons[e] * perimeter, true);

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

async function createMatFromFile(cv, file, options, id) {
  const config = options || {};

  if (typeof workerScope.createImageBitmap !== 'function') {
    throw new Error('Este navegador no soporta lectura avanzada de imagen.');
  }

  postProgress(id, 'leyendo_imagen', 'createImageBitmap');

  const imageBitmap = await workerScope.createImageBitmap(file);
  const maxInputSize = config.maxInputSize || 1000;
  const ratio = Math.min(1, maxInputSize / Math.max(imageBitmap.width, imageBitmap.height));
  const width = Math.max(1, Math.round(imageBitmap.width * ratio));
  const height = Math.max(1, Math.round(imageBitmap.height * ratio));
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(imageBitmap, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);

  if (typeof imageBitmap.close === 'function') {
    imageBitmap.close();
  }

  postProgress(id, 'imagen_convertida', `${width}x${height}`);

  return cv.matFromImageData(imageData);
}

async function fallbackScan(file, options, id, reason) {
  const config = options || {};

  if (typeof workerScope.createImageBitmap !== 'function') {
    throw new Error(reason || 'No se pudo iniciar el escaner.');
  }

  postProgress(id, 'fallback_iniciado', reason || 'OpenCV no disponible');

  const imageBitmap = await workerScope.createImageBitmap(file);
  const maxInputSize = config.maxInputSize || 1200;
  const ratio = Math.min(1, maxInputSize / Math.max(imageBitmap.width, imageBitmap.height));
  const width = Math.max(1, Math.round(imageBitmap.width * ratio));
  const height = Math.max(1, Math.round(imageBitmap.height * ratio));
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(imageBitmap, 0, 0, width, height);

  if (typeof imageBitmap.close === 'function') {
    imageBitmap.close();
  }

  const imageData = ctx.getImageData(0, 0, width, height);
  const enhanced = enhanceImageData(imageData, config.mode || 'natural');
  const outputCanvas = resizeCanvas(imageDataToCanvas(enhanced), config);

  if (typeof outputCanvas.convertToBlob !== 'function') {
    throw new Error('Este navegador no pudo generar la imagen escaneada.');
  }

  const blob = await outputCanvas.convertToBlob({
    type: 'image/jpeg',
    quality: typeof config.quality === 'number' ? config.quality : 0.88
  });

  postProgress(id, 'fallback_finalizado', `${outputCanvas.width}x${outputCanvas.height}`);

  return {
    blob,
    method: 'fallback',
    documentDetected: false,
    width: outputCanvas.width,
    height: outputCanvas.height,
    warning: reason || 'OpenCV no estuvo disponible. Se aplico mejora basica.'
  };
}

async function scanFile(file, options, id) {
  const config = options || {};
  let cv = null;

  try {
    cv = await loadOpenCv(config.opencvSrc || '/opencv/opencv.js', id);
  } catch (error) {
    return fallbackScan(file, config, id, error.message || 'OpenCV no pudo iniciar.');
  }

  const src = await createMatFromFile(cv, file, config, id);

  let outputMat = null;

  try {
    postProgress(id, 'detectando_documento', 'OpenCV');

    const points = detectDocumentPoints(cv, src, config);
    let method = 'original';
    let documentDetected = false;

    if (points) {
      postProgress(id, 'corrigiendo_perspectiva', 'warpPerspective');
      outputMat = warpDocument(cv, src, points);
      method = 'perspective';
      documentDetected = true;
    } else {
      postProgress(id, 'documento_no_detectado', 'usando imagen completa');
      outputMat = src.clone();
    }

    postProgress(id, 'mejorando_imagen', config.mode || 'natural');

    const imageData = enhanceImageData(
      matToImageData(outputMat),
      config.mode || 'natural'
    );

    const outputCanvas = resizeCanvas(imageDataToCanvas(imageData), config);

    if (typeof outputCanvas.convertToBlob !== 'function') {
      throw new Error('Este navegador no pudo generar la imagen escaneada.');
    }

    postProgress(id, 'generando_jpg', `${outputCanvas.width}x${outputCanvas.height}`);

    const blob = await outputCanvas.convertToBlob({
      type: 'image/jpeg',
      quality: typeof config.quality === 'number' ? config.quality : 0.88
    });

    postProgress(id, 'escaneo_finalizado', method);

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

workerScope.addEventListener('message', async function (event) {
  const data = event.data || {};
  const id = data.id;
  const file = data.file;
  const options = data.options || {};

  try {
    if (!id || !file) {
      throw new Error('No se recibio imagen para escanear.');
    }

    postProgress(id, 'mensaje_recibido', 'worker activo');

    const result = await scanFile(file, options, id);

    workerScope.postMessage({
      id,
      ok: true,
      result
    });
  } catch (error) {
    workerScope.postMessage({
      id,
      ok: false,
      step: 'error_worker',
      detail: error && error.stack ? error.stack : '',
      error: error.message || 'No se pudo escanear el acta.'
    });
  }
});