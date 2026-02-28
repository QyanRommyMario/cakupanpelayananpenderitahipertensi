# QA AUDIT REPORT - Fix Ketidaksesuaian Data Input vs Export

**Tanggal**: $(date)  
**Auditor**: QA/Senior Developer  
**Repository**: cakupanpelayananpenderitahipertensi  
**Branch**: main

---

## 1. RINGKASAN MASALAH

Data yang diinput melalui halaman input tidak sesuai dengan data yang diekspor di halaman laporan (Excel/PDF). Angka-angka yang muncul di laporan bisa 0 atau hilang meskipun data sudah diinput.

### Root Cause

Aplikasi memiliki **dua konfigurasi indikator terpisah** yang harus sinkron:

| Config                      | Lokasi                        | Digunakan Oleh                             |
| --------------------------- | ----------------------------- | ------------------------------------------ |
| `INDICATORS_BY_PROGRAM`     | `constants.js` (line 428-558) | Halaman Input (menyimpan ke DB)            |
| `PROGRAMS[type].indicators` | `constants.js` (line 56-289)  | Halaman Laporan (export), ProgramDashboard |

**Masalah**: Nama indikator di `PROGRAMS` (export) **berbeda** dengan `INDICATORS_BY_PROGRAM` (input) untuk program **DIABETES** dan **ODGJ**, sehingga ketika laporan mencari data berdasarkan nama indikator dari `PROGRAMS`, data tidak ditemukan karena tersimpan di DB dengan nama dari `INDICATORS_BY_PROGRAM`.

---

## 2. DETAIL PERUBAHAN

### File yang diubah: `src/utils/constants.js`

#### DIABETES - PROGRAMS.indicators (partB, partBBarang)

| Sebelum (PROGRAMS - Export)               | Sesudah (Menyesuaikan Input)             |
| ----------------------------------------- | ---------------------------------------- |
| `Obat Diabetes Melitus`                   | `Obat Diabetes (Metformin/Glibenklamid)` |
| `Fotometer atau Glukometer`               | `Alat Pemeriksaan Gula Darah`            |
| `Regen Glukosa atau Strip tes Gula darah` | `Strip Gula Darah`                       |

#### ODGJ - PROGRAMS.indicators (partB, partBBarang, partBSDM)

| Sebelum (PROGRAMS - Export)                   | Sesudah (Menyesuaikan Input)                  |
| --------------------------------------------- | --------------------------------------------- |
| `Buku Pedoman Diagnosis (PPDGJ III)`          | **DIHAPUS** (tidak ada di input)              |
| `Penyediaan obat psikofarmaka`                | `Obat Psikotropika (Haloperidol/Risperidone)` |
| `Penyediaan formulir Skrining kesehatan jiwa` | **DIHAPUS** (tidak ada di input)              |
| `Tenaga Kesehatan : Kompetensi Jiwa`          | **DIHAPUS** (tidak ada di input)              |

**Catatan**: Item yang "DIHAPUS" dari PROGRAMS tidak pernah ada di form input (`INDICATORS_BY_PROGRAM`), sehingga tidak pernah bisa diinput oleh user. Menghapusnya dari PROGRAMS hanya membersihkan indikator "hantu" yang selalu bernilai 0.

---

## 3. VERIFIKASI OTOMATIS

### Test 1: Kecocokan Nama Indikator (PROGRAMS vs INDICATORS_BY_PROGRAM)

```
--- USIA_PRODUKTIF ---
  INPUT: 16 indicators | EXPORT: 16 indicators
  RESULT: PASS ✓

--- HIPERTENSI ---
  INPUT: 13 indicators | EXPORT: 13 indicators
  RESULT: PASS ✓

--- DIABETES ---
  INPUT: 13 indicators | EXPORT: 13 indicators
  RESULT: PASS ✓

--- ODGJ ---
  INPUT: 10 indicators | EXPORT: 10 indicators
  RESULT: PASS ✓

OVERALL: ALL PASS - Export config matches input config perfectly
```

### Test 2: Konsistensi Internal

```
Untuk setiap program (USIA_PRODUKTIF, HIPERTENSI, DIABETES, ODGJ):
  [PASS] partB === partBBarang + partBSDM
  [PASS] order === sectionA + sectionBBarang + sectionBSDM
  [PASS] partA === sectionA
  [PASS] partBBarang === sectionBBarang
  [PASS] partBSDM === sectionBSDM

OVERALL: ALL 20 INTERNAL CONSISTENCY CHECKS PASSED
```

---

## 4. ANALISIS DATA FLOW (End-to-End)

### Alur Data Lengkap:

```
[INPUT PAGE]                    [DATABASE]                      [LAPORAN/EXPORT]
INDICATORS_BY_PROGRAM.order  →  achievements.indicator_name  →  PROGRAMS.indicators.*
        ↓                              ↓                               ↓
  Form fields generated          Stored via UPSERT             calculateCategoryData()
  User enters target/real        (conflict on name+pkm+        indicatorData[name] lookup
                                  period+program_type)          → builds Excel/PDF rows
```

### Titik-titik Kritis yang Diaudit:

| Komponen                          | Bagaimana Data Diakses                                               | Status                |
| --------------------------------- | -------------------------------------------------------------------- | --------------------- |
| Input → DB                        | `indicator_name` dari `INDICATORS_BY_PROGRAM.order`                  | ✓ Source of Truth     |
| Laporan Detail                    | `indicatorData[name]` dimana name dari `INDICATORS_BY_PROGRAM.order` | ✓ Match               |
| Laporan `calculateCategoryData()` | `indicatorData[name]` dimana name dari `PROGRAMS.indicators.*`       | ✓ Match (setelah fix) |
| Excel Export                      | Menggunakan `calculateCategoryData()`                                | ✓ Match (setelah fix) |
| PDF Export                        | Menggunakan `calculateCategoryData()`                                | ✓ Match (setelah fix) |
| ProgramDashboard                  | `data.filter(d => partBIndicators.includes(d.indicator_name))`       | ✓ Match (setelah fix) |
| Recap View                        | Sum semua data per puskesmas (tidak filter per nama)                 | ✓ Tidak terpengaruh   |

---

## 5. APAKAH ADA DATA YANG HILANG?

### Jawaban: **TIDAK ADA DATA YANG HILANG**

**Penjelasan**:

1. Data di database **tersimpan menggunakan nama dari `INDICATORS_BY_PROGRAM`** (karena input page menggunakan config ini)
2. Fix yang dilakukan: **mengubah `PROGRAMS` (export) agar sesuai dengan `INDICATORS_BY_PROGRAM` (input)**
3. Arah perbaikan sudah benar: **Export menyesuaikan Input**, bukan sebaliknya
4. Indikator yang dihapus dari PROGRAMS (`Buku Pedoman Diagnosis`, `Penyediaan formulir Skrining`, `Tenaga Kesehatan : Kompetensi Jiwa`) **tidak pernah bisa diinput** karena tidak ada di form input, sehingga tidak ada data yang hilang
5. Tidak ada perubahan pada database atau halaman input

### Data Existing di Database:

- Semua data yang sudah diinput tetap aman di table `achievements`
- Nama-nama indikator di DB sudah menggunakan nama dari `INDICATORS_BY_PROGRAM`
- Setelah fix, `PROGRAMS` config sekarang cocok dengan nama di DB → data akan tampil dengan benar

---

## 6. PROGRAM YANG TIDAK TERPENGARUH

| Program        | Status                                         |
| -------------- | ---------------------------------------------- |
| USIA_PRODUKTIF | ✓ Sudah cocok sejak awal - tidak ada perubahan |
| HIPERTENSI     | ✓ Sudah cocok sejak awal - tidak ada perubahan |

---

## 7. PERUBAHAN LAIN (NON-SUBSTANTIF)

File berikut juga berubah namun hanya **formatting/whitespace** (auto-format):

- `src/app/indikator/page.js` - Perubahan line wrapping saja
- `src/app/laporan/page.js` - Perubahan indentasi dan line wrapping saja

**Tidak ada perubahan logika** pada kedua file tersebut.

---

## 8. KESIMPULAN

| Aspek                                         | Hasil             |
| --------------------------------------------- | ----------------- |
| Fix sudah benar?                              | ✅ **YA**         |
| Export menyesuaikan input (bukan sebaliknya)? | ✅ **YA**         |
| Ada data yang hilang?                         | ✅ **TIDAK ADA**  |
| Semua program terverifikasi?                  | ✅ **4/4 PASS**   |
| Konsistensi internal config?                  | ✅ **20/20 PASS** |
| Data flow end-to-end benar?                   | ✅ **YA**         |
| Build errors?                                 | ✅ **TIDAK ADA**  |

### Rekomendasi untuk Masa Depan:

- Pertimbangkan untuk **menghilangkan dual config** dengan men-derive `INDICATORS_BY_PROGRAM` dari `PROGRAMS` secara programatis, agar tidak perlu maintain dua config terpisah yang harus sinkron manual

---

**Status: APPROVED FOR DEPLOYMENT** ✅
