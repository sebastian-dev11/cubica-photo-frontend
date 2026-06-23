class DocumentScanner {
  static scanFile(file, options = {}) {
    if (!file || !file.type?.startsWith('image/')) {
      return Promise.reject(new Error('Debes seleccionar una imagen válida.'));
    }

    if (typeof Worker === 'undefined') {
      return Promise.reject(new Error('Este navegador no soporta escaneo avanzado en segundo plano.'));
    }

    return new Promise((resolve, reject) => {
      let worker = null;
      let finished = false;

      const id = DocumentScanner.createId();
      const timeout = Number(options.workerTimeout || options.timeout || 45000);

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
          reject(new Error('El escaneo tardó demasiado. Puedes subir la imagen original.'));
        });
      }, timeout);

      try {
        worker = new Worker(new URL('./documentScanner.worker.js', import.meta.url));

        worker.onmessage = (event) => {
          const data = event.data || {};

          if (data.id !== id) return;

          if (!data.ok) {
            finish(() => {
              reject(new Error(data.error || 'No se pudo escanear el acta.'));
            });

            return;
          }

          const result = data.result || {};
          const blob = result.blob;

          if (!blob) {
            finish(() => {
              reject(new Error('No se pudo generar la imagen escaneada.'));
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
              mimeType: 'image/jpeg'
            });
          });
        };

        worker.onerror = (error) => {
          finish(() => {
            reject(new Error(error?.message || 'Error ejecutando el escáner del acta.'));
          });
        };

        worker.onmessageerror = () => {
          finish(() => {
            reject(new Error('No se pudo recibir la respuesta del escáner.'));
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
          reject(new Error(error?.message || 'No se pudo iniciar el escáner del acta.'));
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