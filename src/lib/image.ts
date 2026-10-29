/**
 * Bir base64 görseli tuval (canvas) ile sıkıştırır: en uzun kenar en fazla 1200 px, JPEG kalite 0.82.
 * Görsel değilse ya da çözülemezse olduğu gibi döner. Sunucu da ayrıca yeniden kodlar;
 * bu adım yalnızca yüklemeyi hızlandırır ve veriyi azaltır.
 */
export function compressImage(base64: string, maxDim = 1200, quality = 0.82): Promise<string> {
  return new Promise((resolve) => {
    if (!base64 || !base64.startsWith("data:image")) {
      resolve(base64);
      return;
    }

    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height / width) * maxDim);
          width = maxDim;
        } else {
          width = Math.round((width / height) * maxDim);
          height = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };

    img.onerror = () => resolve(base64); // çözülemezse olduğu gibi bırak; sunucu karar verir
    img.src = base64;
  });
}