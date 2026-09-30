"use client";

export interface Leitura {
  lat: number;
  lng: number;
  precisaoM: number;
  capturadoEm: string;
}

/**
 * RF-35 — captura pontual (nunca contínua): uma leitura de alta precisão,
 * apenas quando o Fast toca no botão, com o app aberto.
 */
export function capturarLocalizacao(timeoutMs = 15000): Promise<Leitura> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Este dispositivo não oferece geolocalização."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precisaoM: pos.coords.accuracy,
          capturadoEm: new Date(pos.timestamp || Date.now()).toISOString(),
        }),
      (err) => {
        const msgs: Record<number, string> = {
          1: "Permissão de localização negada. Ative nas configurações do celular.",
          2: "Localização indisponível. Vá para um local aberto e tente novamente.",
          3: "Tempo esgotado ao obter a localização. Tente novamente.",
        };
        reject(new Error(msgs[err.code] ?? err.message));
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}
