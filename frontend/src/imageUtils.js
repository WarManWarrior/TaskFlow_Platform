export async function imageFileToDataUrl(file, {
  maxDimension = 1600,
  maxDataUrlChars = 2750000,
  maxFileSize = 10 * 1024 * 1024,
} = {}) {
  if (!file || !String(file.type || "").startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > maxFileSize) throw new Error("That file is too large. Choose a smaller image and try again.");
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("This image could not be opened."));
      image.src = objectUrl;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("This image has no readable dimensions.");
    let width = image.naturalWidth, height = image.naturalHeight;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
    for (let resizeAttempt = 0; resizeAttempt < 7; resizeAttempt++) {
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image processing is unavailable in this browser.");
      context.fillStyle = "#ffffff"; context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      for (const quality of [0.84, 0.74, 0.64, 0.54]) {
        let encoded = canvas.toDataURL("image/webp", quality);
        if (!/^data:image\/(?:webp|png|jpeg);base64,/.test(encoded)) encoded = canvas.toDataURL("image/jpeg", quality);
        if (encoded.length <= maxDataUrlChars) return encoded;
      }
      width = Math.max(128, Math.round(width * 0.78));
      height = Math.max(128, Math.round(height * 0.78));
    }
    throw new Error("This image couldn't be compressed enough. Choose a smaller image.");
  } finally { URL.revokeObjectURL(objectUrl); }
}
