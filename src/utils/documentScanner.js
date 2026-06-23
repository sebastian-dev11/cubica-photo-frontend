class DocumentScanner {
  static async loadOpenCv(options = {}) {
    const src = options.src || 'https://docs.opencv.org/4.x/opencv.js';
    const timeout = options.timeout || 30000;

    if (window.cv && window.cv.Mat) {
      return window.cv;
    }

    if (DocumentScanner.cvPromise) {
      return DocumentScanner.cvPromise;
    }

    DocumentScanner.cvPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-opencv-src="${src}"]`);

      const finish = () => {
        if (window.cv && window.cv.Mat) {
          resolve(window.cv);
          return;
        }

        if (window.cv) {
          window.cv.onRuntimeInitialized = () => resolve(window.cv);
          return;
        }

        reject(new Error('No se pudo cargar OpenCV.'));
      };

      if (existing) {
        finish();
        return;
      }

      const script = document.createElement('script');
      const timer = window.setTimeout(() => {
        reject(new Error('Tiempo agotado cargando OpenCV.'));
      }, timeout);

      script.src = src;
      script.async = true;
      script.defer = true;
      script.setAttribute('data-opencv-src', src);

      script.onload = () => {
        window.clearTimeout(timer);
        finish();
      };

      script.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error('Error cargando OpenCV.'));
      };

      document.body.appendChild(script);
    });

    return DocumentScanner.cvPromise;
  }

  static async scanFile(file, options = {}) {
    if (!file || !file.type?.startsWith('image/')) {
      throw new Error('Debes seleccionar una imagen válida.');
    }

    const image = await DocumentScanner.fileToImage(file);

    return await DocumentScanner.scanImage(image, {
      ...options,
      originalName: file.name
    });
  }

  static async fileToImage(file) {
    const url = URL.createObjectURL(file);

    try {
      const image = new Image();

      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = url;
      });

      return image;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  static createCanvasFromImage(image, options = {}) {
    const maxInputSize = options.maxInputSize || 2200;
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const ratio = Math.min(1, maxInputSize / Math.max(width, height));
    const canvas = document.createElement('canvas');

    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));

    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    return canvas;
  }

  static async scanImage(image, options = {}) {
    const cv = await DocumentScanner.loadOpenCv(options);
    const sourceCanvas = DocumentScanner.createCanvasFromImage(image, options);
    const src = cv.imread(sourceCanvas);

    let method = 'original';
    let documentDetected = false;
    let points = null;
    let warpedCanvas = null;

    try {
      points = DocumentScanner.detectDocumentPoints(cv, src, options);

      if (points) {
        warpedCanvas = DocumentScanner.warpDocument(cv, src, points);
        method = 'perspective';
        documentDetected = true;
      }

      if (!warpedCanvas) {
        const boxPoints = DocumentScanner.detectDocumentBoxFromCanvas(sourceCanvas, options);

        if (boxPoints) {
          points = boxPoints;
          warpedCanvas = DocumentScanner.cropCanvasFromPoints(sourceCanvas, boxPoints);
          method = 'box';
          documentDetected = true;
        }
      }

      if (!warpedCanvas) {
        warpedCanvas = sourceCanvas;
      }

      const enhancedCanvas = DocumentScanner.enhanceCanvas(warpedCanvas, options);
      const outputCanvas = DocumentScanner.resizeCanvas(enhancedCanvas, {
        maxWidth: options.maxWidth || 1800,
        maxHeight: options.maxHeight || 2400
      });

      const quality = typeof options.quality === 'number' ? options.quality : 0.92;
      const blob = await DocumentScanner.canvasToBlob(outputCanvas, 'image/jpeg', quality);
      const file = DocumentScanner.blobToFile(
        blob,
        DocumentScanner.buildOutputName(options.originalName),
        'image/jpeg'
      );

      return {
        file,
        blob,
        canvas: outputCanvas,
        points,
        method,
        documentDetected,
        width: outputCanvas.width,
        height: outputCanvas.height,
        mimeType: 'image/jpeg'
      };
    } finally {
      src.delete();
    }
  }

  static detectDocumentPoints(cv, src, options = {}) {
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
            const points = DocumentScanner.pointsFromMat(approx);

            if (DocumentScanner.isUsableDocument(points, src.cols, src.rows)) {
              bestPoints = points;
              bestArea = area;
            }
          }

          approx.delete();
        }

        contour.delete();
      }

      return bestPoints ? DocumentScanner.orderPoints(bestPoints) : null;
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

  static pointsFromMat(mat) {
    const points = [];

    for (let i = 0; i < mat.rows; i += 1) {
      points.push({
        x: mat.data32S[i * 2],
        y: mat.data32S[i * 2 + 1]
      });
    }

    return points;
  }

  static isUsableDocument(points, width, height) {
    if (!Array.isArray(points) || points.length !== 4) return false;

    const ordered = DocumentScanner.orderPoints(points);
    const docWidth = Math.max(
      DocumentScanner.distance(ordered[0], ordered[1]),
      DocumentScanner.distance(ordered[3], ordered[2])
    );
    const docHeight = Math.max(
      DocumentScanner.distance(ordered[0], ordered[3]),
      DocumentScanner.distance(ordered[1], ordered[2])
    );

    if (docWidth < width * 0.25 || docHeight < height * 0.25) return false;

    const area = DocumentScanner.polygonArea(ordered);
    const imageArea = width * height;

    return area / imageArea >= 0.16;
  }

  static orderPoints(points) {
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

  static distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  static polygonArea(points) {
    let area = 0;

    for (let i = 0; i < points.length; i += 1) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }

    return Math.abs(area / 2);
  }

  static warpDocument(cv, src, points) {
    const ordered = DocumentScanner.orderPoints(points);
    const widthTop = DocumentScanner.distance(ordered[0], ordered[1]);
    const widthBottom = DocumentScanner.distance(ordered[3], ordered[2]);
    const heightLeft = DocumentScanner.distance(ordered[0], ordered[3]);
    const heightRight = DocumentScanner.distance(ordered[1], ordered[2]);

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

      const canvas = document.createElement('canvas');
      cv.imshow(canvas, dst);

      return canvas;
    } finally {
      srcTri.delete();
      dstTri.delete();
      matrix.delete();
      dst.delete();
    }
  }

  static detectDocumentBoxFromCanvas(canvas, options = {}) {
    const threshold = options.boxThreshold || 185;
    const minRowCoverage = options.minRowCoverage || 0.14;
    const minColCoverage = options.minColCoverage || 0.14;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const rowCounts = new Uint32Array(canvas.height);
    const colCounts = new Uint32Array(canvas.width);

    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const idx = (y * canvas.width + x) * 4;
        const r = image.data[idx];
        const g = image.data[idx + 1];
        const b = image.data[idx + 2];
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;

        if (luma >= threshold) {
          rowCounts[y] += 1;
          colCounts[x] += 1;
        }
      }
    }

    const minRow = Math.max(1, Math.floor(canvas.width * minRowCoverage));
    const minCol = Math.max(1, Math.floor(canvas.height * minColCoverage));
    const top = DocumentScanner.firstIndex(rowCounts, minRow);
    const bottom = DocumentScanner.lastIndex(rowCounts, minRow);
    const left = DocumentScanner.firstIndex(colCounts, minCol);
    const right = DocumentScanner.lastIndex(colCounts, minCol);

    if (top < 0 || bottom < 0 || left < 0 || right < 0) {
      return null;
    }

    const paddingX = Math.round((right - left) * 0.018);
    const paddingY = Math.round((bottom - top) * 0.018);
    const x1 = Math.max(0, left - paddingX);
    const y1 = Math.max(0, top - paddingY);
    const x2 = Math.min(canvas.width - 1, right + paddingX);
    const y2 = Math.min(canvas.height - 1, bottom + paddingY);
    const areaRatio = ((x2 - x1) * (y2 - y1)) / (canvas.width * canvas.height);

    if (areaRatio < 0.16) {
      return null;
    }

    return [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 }
    ];
  }

  static firstIndex(counts, minCount) {
    for (let i = 0; i < counts.length; i += 1) {
      if (counts[i] >= minCount) return i;
    }

    return -1;
  }

  static lastIndex(counts, minCount) {
    for (let i = counts.length - 1; i >= 0; i -= 1) {
      if (counts[i] >= minCount) return i;
    }

    return -1;
  }

  static cropCanvasFromPoints(canvas, points) {
    const ordered = DocumentScanner.orderPoints(points);
    const left = Math.max(0, Math.floor(Math.min(ordered[0].x, ordered[3].x)));
    const top = Math.max(0, Math.floor(Math.min(ordered[0].y, ordered[1].y)));
    const right = Math.min(canvas.width, Math.ceil(Math.max(ordered[1].x, ordered[2].x)));
    const bottom = Math.min(canvas.height, Math.ceil(Math.max(ordered[2].y, ordered[3].y)));
    const width = Math.max(1, right - left);
    const height = Math.max(1, bottom - top);
    const output = document.createElement('canvas');

    output.width = width;
    output.height = height;

    const ctx = output.getContext('2d', { alpha: false });
    ctx.drawImage(canvas, left, top, width, height, 0, 0, width, height);

    return output;
  }

  static enhanceCanvas(canvas, options = {}) {
    const mode = options.mode || 'natural';
    const output = document.createElement('canvas');

    output.width = canvas.width;
    output.height = canvas.height;

    const ctx = output.getContext('2d', { alpha: false });

    if (mode === 'clean') {
      ctx.filter = 'brightness(1.1) contrast(1.12) saturate(0.55)';
    } else if (mode === 'bn') {
      ctx.filter = 'grayscale(1) brightness(1.08) contrast(1.16)';
    } else {
      ctx.filter = 'brightness(1.04) contrast(1.06) saturate(0.9)';
    }

    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';

    if (mode === 'clean') {
      DocumentScanner.whitenBackground(output, {
        whitePoint: options.whitePoint || 188,
        blackPoint: options.blackPoint || 72,
        strength: options.whiteStrength || 0.48
      });
    }

    if (mode === 'bn') {
      DocumentScanner.applyBlackAndWhite(output, {
        threshold: options.threshold || 164
      });
    }

    return output;
  }

  static whitenBackground(canvas, options = {}) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const whitePoint = options.whitePoint;
    const blackPoint = options.blackPoint;
    const strength = options.strength;

    for (let i = 0; i < image.data.length; i += 4) {
      const r = image.data[i];
      const g = image.data[i + 1];
      const b = image.data[i + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;

      if (luma > whitePoint) {
        const factor = Math.min(1, ((luma - whitePoint) / (255 - whitePoint)) * strength);
        image.data[i] = Math.round(r + (255 - r) * factor);
        image.data[i + 1] = Math.round(g + (255 - g) * factor);
        image.data[i + 2] = Math.round(b + (255 - b) * factor);
      }

      if (luma < blackPoint) {
        image.data[i] = Math.round(r * 0.9);
        image.data[i + 1] = Math.round(g * 0.9);
        image.data[i + 2] = Math.round(b * 0.9);
      }
    }

    ctx.putImageData(image, 0, 0);
  }

  static applyBlackAndWhite(canvas, options = {}) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const threshold = options.threshold || 164;

    for (let i = 0; i < image.data.length; i += 4) {
      const r = image.data[i];
      const g = image.data[i + 1];
      const b = image.data[i + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      const value = luma >= threshold ? 255 : 0;

      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = value;
    }

    ctx.putImageData(image, 0, 0);
  }

  static resizeCanvas(canvas, options = {}) {
    const maxWidth = options.maxWidth || 1800;
    const maxHeight = options.maxHeight || 2400;
    const ratio = Math.min(1, maxWidth / canvas.width, maxHeight / canvas.height);

    if (ratio >= 1) {
      return canvas;
    }

    const output = document.createElement('canvas');

    output.width = Math.max(1, Math.round(canvas.width * ratio));
    output.height = Math.max(1, Math.round(canvas.height * ratio));

    const ctx = output.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, output.width, output.height);

    return output;
  }

  static canvasToBlob(canvas, type = 'image/jpeg', quality = 0.92) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('No se pudo generar la imagen escaneada.'));
          return;
        }

        resolve(blob);
      }, type, quality);
    });
  }

  static blobToFile(blob, name, type) {
    try {
      return new File([blob], name, { type });
    } catch {
      blob.name = name;
      blob.type = type;
      return blob;
    }
  }

  static buildOutputName(originalName = 'acta.jpg') {
    const base = String(originalName || 'acta')
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/\s+/g, '_')
      .trim() || 'acta';

    return `${base}-escaneada.jpg`;
  }
}

DocumentScanner.cvPromise = null;

export default DocumentScanner;