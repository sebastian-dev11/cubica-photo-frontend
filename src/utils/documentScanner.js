class DocumentScanner {
  static scanFile(file, options = {}) {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      return Promise.reject(new Error('Debes seleccionar una imagen válida.'));
    }

    if (typeof Worker === 'undefined') {
      return Promise.reject(new Error('Este navegador no soporta escaneo avanzado en segundo plano.'));
    }

    return new Promise((resolve, reject) => {
      let worker = null;
      let finished = false;
      let lastStep = 'iniciando';
      let lastDetail = '';

      const id = DocumentScanner.createId();
      const requestedTimeout = Number(options.workerTimeout || options.timeout || 180000);
      const timeout = Math.max(180000, requestedTimeout);

      const logProgress = (step, detail) => {
        lastStep = step || lastStep;
        lastDetail = detail || '';

        if (options.debugScanner !== false) {
          console.log(`[scanner-acta] ${lastStep}${lastDetail ? ` - ${lastDetail}` : ''}`);
        }

        if (typeof options.onProgress === 'function') {
          options.onProgress({
            step: lastStep,
            detail: lastDetail
          });
        }
      };

      const finish = (callback) => {
        if (finished) return;

        finished = true;

        if (timer) {
          window.clearTimeout(timer);
        }

        if (worker) {
          worker.terminate();
          worker = null;
        }

        callback();
      };

      const timer = window.setTimeout(() => {
        finish(() => {
          reject(new Error(`El escaneo tardó demasiado. Último paso: ${lastStep}${lastDetail ? ` - ${lastDetail}` : ''}`));
        });
      }, timeout);

      try {
        worker = new Worker(new URL('./documentScanner.worker.js', import.meta.url));

        logProgress('worker_creado', 'Iniciando escáner en segundo plano');

        worker.onmessage = (event) => {
          const data = event.data || {};

          if (data.id !== id) return;

          if (data.type === 'progress') {
            logProgress(data.step, data.detail);
            return;
          }

          if (!data.ok) {
            finish(() => {
              const step = data.step || lastStep;
              const detail = data.detail || lastDetail;
              const message = data.error || 'No se pudo escanear el acta.';

              reject(new Error(`${message} Paso: ${step}${detail ? ` - ${detail}` : ''}`));
            });

            return;
          }

          const result = data.result || {};
          const blob = result.blob;

          if (!blob) {
            finish(() => {
              reject(new Error(`No se pudo generar la imagen escaneada. Último paso: ${lastStep}`));
            });

            return;
          }

          const outputFile = DocumentScanner.blobToFile(
            blob,
            DocumentScanner.buildOutputName(file.name),
            'image/jpeg'
          );

          finish(() => {
            resolve({
              file: outputFile,
              blob,
              canvas: null,
              points: null,
              method: result.method || 'worker',
              documentDetected: Boolean(result.documentDetected),
              width: result.width || null,
              height: result.height || null,
              mimeType: 'image/jpeg',
              warning: result.warning || null
            });
          });
        };

        worker.onerror = (error) => {
          finish(() => {
            const message = error && error.message ? error.message : 'Error ejecutando el escáner del acta.';
            const filename = error && error.filename ? error.filename : '';
            const line = error && error.lineno ? ` Línea: ${error.lineno}` : '';

            reject(new Error(`${message} Último paso: ${lastStep}${lastDetail ? ` - ${lastDetail}` : ''}${filename ? ` Archivo: ${filename}` : ''}${line}`));
          });
        };

        worker.onmessageerror = () => {
          finish(() => {
            reject(new Error(`No se pudo recibir la respuesta del escáner. Último paso: ${lastStep}`));
          });
        };

        worker.postMessage({
          id,
          file,
          options: {
            ...options,
            opencvSrc: options.opencvSrc || '/opencv/opencv.js'
          }
        });
      } catch (error) {
        finish(() => {
          reject(new Error(error && error.message ? error.message : 'No se pudo iniciar el escáner del acta.'));
        });
      }
    });
  }

  static createId() {
    return `scan_${Date.now()}_${Math.random().toString(16).slice(2)}`;
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

export default DocumentScanner;