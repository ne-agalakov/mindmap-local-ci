import {
  LEGACY_STORAGE,
  buildLegacyEvidence,
  readLegacyDatabaseReadOnly,
  sha256Hex,
} from "./core.mjs";

const prepareButton = document.querySelector("#prepare");
const statusNode = document.querySelector("#status");
const downloadsNode = document.querySelector("#downloads");
const databaseDownload = document.querySelector("#database-download");
const evidenceDownload = document.querySelector("#evidence-download");
document.querySelector("#origin").textContent = location.origin;

let objectUrls = [];
const clearObjectUrls = () => {
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls = [];
};

const setStatus = (message, className = "") => {
  statusNode.textContent = message;
  statusNode.className = className;
};

const downloadNameTimestamp = () => new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");

prepareButton.addEventListener("click", async () => {
  prepareButton.disabled = true;
  downloadsNode.hidden = true;
  clearObjectUrls();
  setStatus("Чтение существующей базы в режиме readonly…");

  try {
    if (location.origin !== LEGACY_STORAGE.expectedOrigin) {
      throw new Error(`wrong_origin: открой инструмент строго на ${LEGACY_STORAGE.expectedOrigin}`);
    }

    const bytes = await readLegacyDatabaseReadOnly();
    setStatus("База прочитана. Вычисление SHA-256…");
    const hash = await sha256Hex(bytes);
    const timestamp = downloadNameTimestamp();
    const evidence = buildLegacyEvidence({
      bytes,
      sha256: hash,
      origin: location.origin,
    });

    const databaseUrl = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.sqlite3" }));
    const evidenceUrl = URL.createObjectURL(new Blob([
      `${JSON.stringify(evidence, null, 2)}\n`,
    ], { type: "application/json" }));
    objectUrls = [databaseUrl, evidenceUrl];

    databaseDownload.href = databaseUrl;
    databaseDownload.download = `mindmap-legacy-${timestamp}-${hash.slice(0, 12)}.sqlite`;
    evidenceDownload.href = evidenceUrl;
    evidenceDownload.download = `mindmap-legacy-${timestamp}-${hash.slice(0, 12)}.evidence.json`;
    downloadsNode.hidden = false;
    setStatus(
      `Готово. База не изменялась.\nРазмер: ${bytes.byteLength.toLocaleString("ru-RU")} байт\nSHA-256: ${hash}\nAI-вызовы: 0`,
      "ok",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(`Экспорт остановлен: ${message}\nНикаких записей и AI-вызовов не выполнено.`, "error");
  } finally {
    prepareButton.disabled = false;
  }
});

window.addEventListener("beforeunload", clearObjectUrls);
