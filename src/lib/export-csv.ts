export function exporterCsv(nomFichier: string, colonnes: string[], lignes: (string | number | null | undefined)[][]) {
  const echapper = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const contenu = [colonnes, ...lignes]
    .map((ligne) => ligne.map(echapper).join(";"))
    .join("\r\n");

  const blob = new Blob(["﻿" + contenu], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nomFichier}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
