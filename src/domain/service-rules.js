/**
 * Aturan interval servis berkala AUT0MAN.
 * Bengkel Nasmoco menggunakan interval 10.000 KM; bengkel lain 7.000 KM.
 * Fungsi dibuat murni agar dapat diuji tanpa koneksi Firebase atau browser.
 */
export function getServiceInterval(workshop) {
  const isNasmoco = String(workshop ?? "").trim().toLowerCase().includes("nasmoco");
  return {
    intervalKm: isNasmoco ? 10000 : 7000,
    intervalRule: isNasmoco ? "Nasmoco = 10.000 KM" : "Selain Nasmoco = 7.000 KM"
  };
}
