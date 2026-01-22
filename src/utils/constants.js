/**
 * CENTRAL CONFIG - Single Source of Truth untuk seluruh aplikasi
 * File ini adalah "otak" aplikasi untuk menjaga konsistensi
 */

// ============================================
// PROGRAM TYPES - Nilai untuk database
// ============================================
export const PROGRAM_TYPES = {
  HIPERTENSI: 'HIPERTENSI',
  DIABETES: 'DIABETES',
  ODGJ: 'ODGJ'
};

// ============================================
// PROGRAMS CONFIG - Konfigurasi lengkap per program
// ============================================
export const PROGRAMS = {
  HIPERTENSI: {
    id: 'HIPERTENSI',
    label: 'SPM Hipertensi',
    shortLabel: 'Hipertensi',
    description: 'Pelayanan Kesehatan Penderita Hipertensi',
    path: '/hipertensi',
    // DEFINISI KATEGORI INDIKATOR (PENTING!)
    indicators: {
      // Bagian A: Sasaran Manusia (Pelayanan Dasar)
      partA: ['JUMLAH YANG HARUS DILAYANI'],
      // Bagian B: Sasaran Barang/Jasa (Mutu Layanan)
      partB: [
        'Obat Hipertensi',
        'Tensimeter',
        'Pedoman pengendalian Hipertensi dan media Komunikasi, Informasi, Edukasi (KIE)',
        'Media Promosi Kesehatan',
        'Formulir pencatatan dan pelaporan Aplikasi Sehat Indonesiaku (ASIK)',
        'Tenaga Medis : Dokter',
        'Tenaga Kesehatan : Bidan',
        'Tenaga Kesehatan : Perawat',
        'Tenaga Kesehatan : Tenaga Gizi',
        'Tenaga Kesehatan : Tenaga Promosi Kesehatan dan Ilmu Perilaku',
        'Tenaga Kesehatan : Tenaga Kefarmasian',
        'Tenaga Kesehatan : Tenaga Kesehatan Masyarakat',
      ],
      // Sub-kategori Part B untuk tampilan granular
      partBBarang: [
        'Obat Hipertensi',
        'Tensimeter',
        'Pedoman pengendalian Hipertensi dan media Komunikasi, Informasi, Edukasi (KIE)',
        'Media Promosi Kesehatan',
        'Formulir pencatatan dan pelaporan Aplikasi Sehat Indonesiaku (ASIK)',
      ],
      partBSDM: [
        'Tenaga Medis : Dokter',
        'Tenaga Kesehatan : Bidan',
        'Tenaga Kesehatan : Perawat',
        'Tenaga Kesehatan : Tenaga Gizi',
        'Tenaga Kesehatan : Tenaga Promosi Kesehatan dan Ilmu Perilaku',
        'Tenaga Kesehatan : Tenaga Kefarmasian',
        'Tenaga Kesehatan : Tenaga Kesehatan Masyarakat',
      ],
    },
    theme: {
      name: 'rose',
      // Warna Primary
      primary: '#e11d48',        // rose-600
      primaryLight: '#ffe4e6',   // rose-100
      primaryDark: '#be123c',    // rose-700
      // Tailwind Classes
      bg: 'bg-rose-600',
      bgLight: 'bg-rose-100',
      bgLighter: 'bg-rose-50',
      text: 'text-rose-600',
      textDark: 'text-rose-700',
      textLight: 'text-rose-100',
      border: 'border-rose-200',
      borderDark: 'border-rose-600',
      ring: 'ring-rose-500',
      hover: 'hover:bg-rose-700',
      // Chart Colors
      chartPrimary: '#e11d48',
      chartSecondary: '#fb7185',
      chartAccent: '#fda4af',
    },
    icon: '❤️',
  },
  DIABETES: {
    id: 'DIABETES',
    label: 'SPM Diabetes Melitus',
    shortLabel: 'Diabetes',
    description: 'Pelayanan Kesehatan Penderita Diabetes Melitus',
    path: '/diabetes',
    // DEFINISI KATEGORI INDIKATOR (PENTING!)
    indicators: {
      // Bagian A: Sasaran Manusia (Pelayanan Dasar)
      partA: ['JUMLAH YANG HARUS DILAYANI'],
      // Bagian B: Sasaran Barang/Jasa (Mutu Layanan)
      partB: [
        'Obat Diabetes Melitus',
        'Fotometer atau Glukometer',
        'Regen Glukosa atau Strip tes Gula darah',
        'Pedoman Pengendalian DM dan media KIE',
        'Media Promosi Kesehatan',
        'Formulir pencatatan dan pelaporan',
        'Tenaga Medis : Dokter',
        'Tenaga Kesehatan : Bidan',
        'Tenaga Kesehatan : Perawat',
        'Tenaga Kesehatan : Tenaga Gizi',
        'Tenaga Kesehatan : Tenaga Promosi Kesehatan',
        'Tenaga Kesehatan : Tenaga Kefarmasian',
      ],
      partBBarang: [
        'Obat Diabetes Melitus',
        'Fotometer atau Glukometer',
        'Regen Glukosa atau Strip tes Gula darah',
        'Pedoman Pengendalian DM dan media KIE',
        'Media Promosi Kesehatan',
        'Formulir pencatatan dan pelaporan',
      ],
      partBSDM: [
        'Tenaga Medis : Dokter',
        'Tenaga Kesehatan : Bidan',
        'Tenaga Kesehatan : Perawat',
        'Tenaga Kesehatan : Tenaga Gizi',
        'Tenaga Kesehatan : Tenaga Promosi Kesehatan',
        'Tenaga Kesehatan : Tenaga Kefarmasian',
      ],
    },
    theme: {
      name: 'emerald',
      // Warna Primary
      primary: '#059669',        // emerald-600
      primaryLight: '#d1fae5',   // emerald-100
      primaryDark: '#047857',    // emerald-700
      // Tailwind Classes
      bg: 'bg-emerald-600',
      bgLight: 'bg-emerald-100',
      bgLighter: 'bg-emerald-50',
      text: 'text-emerald-600',
      textDark: 'text-emerald-700',
      textLight: 'text-emerald-100',
      border: 'border-emerald-200',
      borderDark: 'border-emerald-600',
      ring: 'ring-emerald-500',
      hover: 'hover:bg-emerald-700',
      // Chart Colors
      chartPrimary: '#059669',
      chartSecondary: '#34d399',
      chartAccent: '#6ee7b7',
    },
    icon: '🩸',
  },
  ODGJ: {
    id: 'ODGJ',
    label: 'SPM ODGJ Berat',
    shortLabel: 'ODGJ',
    description: 'Pelayanan Kesehatan Orang dengan Gangguan Jiwa Berat',
    path: '/odgj',
    // DEFINISI KATEGORI INDIKATOR (PENTING!)
    indicators: {
      // Bagian A: Sasaran Manusia (Pelayanan Dasar)
      partA: ['JUMLAH YANG HARUS DILAYANI'],
      // Bagian B: Sasaran Barang/Jasa (Mutu Layanan)
      partB: [
        'Buku Pedoman Diagnosis (PPDGJ III)',
        'Penyediaan obat psikofarmaka',
        'Penyediaan formulir Skrining kesehatan jiwa',
        'Pedoman Pengendalian Kesehatan Jiwa dan media KIE',
        'Media Promosi Kesehatan Jiwa',
        'Alat Fiksasi (Restraint)',
        'Formulir pencatatan dan pelaporan Keswa',
        'Tenaga Medis : Dokter',
        'Tenaga Kesehatan : Perawat',
        'Tenaga Kesehatan : Kompetensi Jiwa',
        'Tenaga Kesehatan : Psikolog/Pekerja Sosial',
        'Tenaga Kesehatan : Tenaga Promosi Kesehatan',
      ],
      partBBarang: [
        'Buku Pedoman Diagnosis (PPDGJ III)',
        'Penyediaan obat psikofarmaka',
        'Penyediaan formulir Skrining kesehatan jiwa',
        'Pedoman Pengendalian Kesehatan Jiwa dan media KIE',
        'Media Promosi Kesehatan Jiwa',
        'Alat Fiksasi (Restraint)',
        'Formulir pencatatan dan pelaporan Keswa',
      ],
      partBSDM: [
        'Tenaga Medis : Dokter',
        'Tenaga Kesehatan : Perawat',
        'Tenaga Kesehatan : Kompetensi Jiwa',
        'Tenaga Kesehatan : Psikolog/Pekerja Sosial',
        'Tenaga Kesehatan : Tenaga Promosi Kesehatan',
      ],
    },
    theme: {
      name: 'violet',
      // Warna Primary
      primary: '#7c3aed',        // violet-600
      primaryLight: '#ede9fe',   // violet-100
      primaryDark: '#6d28d9',    // violet-700
      // Tailwind Classes
      bg: 'bg-violet-600',
      bgLight: 'bg-violet-100',
      bgLighter: 'bg-violet-50',
      text: 'text-violet-600',
      textDark: 'text-violet-700',
      textLight: 'text-violet-100',
      border: 'border-violet-200',
      borderDark: 'border-violet-600',
      ring: 'ring-violet-500',
      hover: 'hover:bg-violet-700',
      // Chart Colors
      chartPrimary: '#7c3aed',
      chartSecondary: '#a78bfa',
      chartAccent: '#c4b5fd',
    },
    icon: '🧠',
  }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Array untuk iterasi (dropdown, navigasi, dll)
export const PROGRAM_TYPES_LIST = Object.values(PROGRAMS).map(p => ({
  value: p.id,
  label: p.label,
  shortLabel: p.shortLabel,
  path: p.path,
  theme: p.theme,
  icon: p.icon,
}));

// Validator untuk memastikan program type valid
export const isValidProgramType = (type) => {
  return Object.keys(PROGRAMS).includes(type);
};

// Mendapatkan konfigurasi program berdasarkan ID
export const getProgram = (programId) => {
  if (!isValidProgramType(programId)) {
    console.error(`getProgram: programId tidak valid: "${programId}"`);
    return PROGRAMS.HIPERTENSI; // Fallback ke Hipertensi
  }
  return PROGRAMS[programId];
};

// Mendapatkan label dari program type
export const getProgramLabel = (type) => {
  const program = PROGRAMS[type];
  return program ? program.label : 'Unknown Program';
};

// Mendapatkan short label dari program type
export const getProgramShortLabel = (type) => {
  const program = PROGRAMS[type];
  return program ? program.shortLabel : 'Unknown';
};

// Mendapatkan theme dari program type
export const getProgramTheme = (type) => {
  const program = PROGRAMS[type];
  return program ? program.theme : PROGRAMS.HIPERTENSI.theme;
};

// Mendapatkan program berdasarkan path
export const getProgramByPath = (path) => {
  return Object.values(PROGRAMS).find(p => p.path === path) || PROGRAMS.HIPERTENSI;
};

// ============================================
// INDICATOR HELPERS - Pemisah Data A & B
// ============================================

// Mendapatkan semua indikator dari program (partA + partB)
export const getAllIndicators = (programId) => {
  const program = PROGRAMS[programId];
  if (!program || !program.indicators) return [];
  return [...program.indicators.partA, ...program.indicators.partB];
};

// Mendapatkan indikator Part A (Manusia/Layanan Dasar)
export const getPartAIndicators = (programId) => {
  const program = PROGRAMS[programId];
  if (!program || !program.indicators) return [];
  return program.indicators.partA;
};

// Mendapatkan indikator Part B (Barang/Jasa/Mutu)
export const getPartBIndicators = (programId) => {
  const program = PROGRAMS[programId];
  if (!program || !program.indicators) return [];
  return program.indicators.partB;
};

// Mendapatkan indikator Part B - Barang saja
export const getPartBBarangIndicators = (programId) => {
  const program = PROGRAMS[programId];
  if (!program || !program.indicators) return [];
  return program.indicators.partBBarang || [];
};

// Mendapatkan indikator Part B - SDM saja
export const getPartBSDMIndicators = (programId) => {
  const program = PROGRAMS[programId];
  if (!program || !program.indicators) return [];
  return program.indicators.partBSDM || [];
};

// Cek apakah indikator termasuk Part A
export const isPartAIndicator = (programId, indicatorName) => {
  const partA = getPartAIndicators(programId);
  return partA.includes(indicatorName);
};

// Cek apakah indikator termasuk Part B
export const isPartBIndicator = (programId, indicatorName) => {
  const partB = getPartBIndicators(programId);
  return partB.includes(indicatorName);
};

// ============================================
// INDICATOR CONFIG PER PROGRAM (Legacy Support)
// ============================================
export const INDICATORS_BY_PROGRAM = {
  HIPERTENSI: {
    order: [
      "JUMLAH YANG HARUS DILAYANI",
      "Pedoman pengendalian Hipertensi dan media Komunikasi, Informasi, Edukasi (KIE)",
      "Media Promosi Kesehatan",
      "Obat Hipertensi",
      "Tensimeter",
      "Formulir pencatatan dan pelaporan Aplikasi Sehat Indonesiaku (ASIK)",
      "Tenaga Medis : Dokter",
      "Tenaga Kesehatan : Bidan",
      "Tenaga Kesehatan : Perawat",
      "Tenaga Kesehatan : Tenaga Gizi",
      "Tenaga Kesehatan : Tenaga Promosi Kesehatan dan Ilmu Perilaku",
      "Tenaga Kesehatan : Tenaga Kefarmasian",
      "Tenaga Kesehatan : Tenaga Kesehatan Masyarakat",
    ],
    sectionA: ["JUMLAH YANG HARUS DILAYANI"],
    sectionBBarang: [
      "Pedoman pengendalian Hipertensi dan media Komunikasi, Informasi, Edukasi (KIE)",
      "Media Promosi Kesehatan",
      "Obat Hipertensi",
      "Tensimeter",
      "Formulir pencatatan dan pelaporan Aplikasi Sehat Indonesiaku (ASIK)",
    ],
    sectionBSDM: [
      "Tenaga Medis : Dokter",
      "Tenaga Kesehatan : Bidan",
      "Tenaga Kesehatan : Perawat",
      "Tenaga Kesehatan : Tenaga Gizi",
      "Tenaga Kesehatan : Tenaga Promosi Kesehatan dan Ilmu Perilaku",
      "Tenaga Kesehatan : Tenaga Kefarmasian",
      "Tenaga Kesehatan : Tenaga Kesehatan Masyarakat",
    ],
  },
  DIABETES: {
    order: [
      "JUMLAH YANG HARUS DILAYANI",
      "Pedoman Pengendalian DM dan media KIE",
      "Media Promosi Kesehatan",
      "Obat Diabetes (Metformin/Glibenklamid)",
      "Alat Pemeriksaan Gula Darah",
      "Strip Gula Darah",
      "Formulir pencatatan dan pelaporan",
      "Tenaga Medis : Dokter",
      "Tenaga Kesehatan : Bidan",
      "Tenaga Kesehatan : Perawat",
      "Tenaga Kesehatan : Tenaga Gizi",
      "Tenaga Kesehatan : Tenaga Promosi Kesehatan",
      "Tenaga Kesehatan : Tenaga Kefarmasian",
    ],
    sectionA: ["JUMLAH YANG HARUS DILAYANI"],
    sectionBBarang: [
      "Pedoman Pengendalian DM dan media KIE",
      "Media Promosi Kesehatan",
      "Obat Diabetes (Metformin/Glibenklamid)",
      "Alat Pemeriksaan Gula Darah",
      "Strip Gula Darah",
      "Formulir pencatatan dan pelaporan",
    ],
    sectionBSDM: [
      "Tenaga Medis : Dokter",
      "Tenaga Kesehatan : Bidan",
      "Tenaga Kesehatan : Perawat",
      "Tenaga Kesehatan : Tenaga Gizi",
      "Tenaga Kesehatan : Tenaga Promosi Kesehatan",
      "Tenaga Kesehatan : Tenaga Kefarmasian",
    ],
  },
  ODGJ: {
    order: [
      "JUMLAH YANG HARUS DILAYANI",
      "Pedoman Pengendalian Kesehatan Jiwa dan media KIE",
      "Media Promosi Kesehatan Jiwa",
      "Obat Psikotropika (Haloperidol/Risperidone)",
      "Alat Fiksasi (Restraint)",
      "Formulir pencatatan dan pelaporan Keswa",
      "Tenaga Medis : Dokter",
      "Tenaga Kesehatan : Perawat",
      "Tenaga Kesehatan : Psikolog/Pekerja Sosial",
      "Tenaga Kesehatan : Tenaga Promosi Kesehatan",
    ],
    sectionA: ["JUMLAH YANG HARUS DILAYANI"],
    sectionBBarang: [
      "Pedoman Pengendalian Kesehatan Jiwa dan media KIE",
      "Media Promosi Kesehatan Jiwa",
      "Obat Psikotropika (Haloperidol/Risperidone)",
      "Alat Fiksasi (Restraint)",
      "Formulir pencatatan dan pelaporan Keswa",
    ],
    sectionBSDM: [
      "Tenaga Medis : Dokter",
      "Tenaga Kesehatan : Perawat",
      "Tenaga Kesehatan : Psikolog/Pekerja Sosial",
      "Tenaga Kesehatan : Tenaga Promosi Kesehatan",
    ],
  },
};

// Get indicators for a specific program
export const getIndicatorsForProgram = (programId) => {
  return INDICATORS_BY_PROGRAM[programId] || INDICATORS_BY_PROGRAM.HIPERTENSI;
};
