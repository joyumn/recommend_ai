"use client";

/**
 * 폰 사진은 5MB가 넘는다. 긴 변 1024px로 줄여야 올리는 것도 읽는 것도 빠르고 저렴하다.
 * 사진을 올리는 곳이 두 군데(식사 사진 탭, 지난 3일 끼니별)라 여기 모아 둔다.
 */
export async function shrinkToBase64(file: File): Promise<{ base64: string; dataUrl: string }> {
  const bitmap = await createImageBitmap(file);
  const max = 1024;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이미지를 처리하지 못했습니다.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { base64: dataUrl.split(",")[1], dataUrl };
}
