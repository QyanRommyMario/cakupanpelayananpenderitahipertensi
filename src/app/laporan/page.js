"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";
import { calculateMetrics } from "@/lib/dataHelpers";
import {
  generateTriwulanOptions,
  getCurrentPeriod,
  parsePeriod,
  isAnnualPeriod,
  getQuartersForYear,
  formatPeriodLabel,
} from "@/utils/periods";
import {
  PROGRAM_TYPES,
  PROGRAM_TYPES_LIST,
  isValidProgramType,
  getProgram,
  getIndicatorsForProgram,
  getProgramLabel,
} from "@/utils/constants";

export default function LaporanPage() {
  const router = useRouter();
  const [data, setData] = useState([]);
  const [puskesmasList, setPuskesmasList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  // User info
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Filter states
  const [selectedPuskesmas, setSelectedPuskesmas] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [selectedProgramType, setSelectedProgramType] = useState(PROGRAM_TYPES.HIPERTENSI); // BARU
  const periodOptions = useMemo(() => generateTriwulanOptions(), []);

  // Get program config and indicators dynamically
  const programConfig = useMemo(() => getProgram(selectedProgramType), [selectedProgramType]);
  const programIndicators = useMemo(() => getIndicatorsForProgram(selectedProgramType), [selectedProgramType]);

  // Check if user is admin
  const checkIsAdmin = (email) => {
    const adminEmails = [
      "kab@dinkes.go.id",
      "admin@dinkes.go.id",
      "admin@example.com",
    ];
    return adminEmails.includes(email?.toLowerCase());
  };

  // Fetch user session & initial data
  useEffect(() => {
    async function initData() {
      try {
        setLoading(true);

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!session) {
          router.push("/login");
          return;
        }

        setCurrentUser(session.user);
        const adminStatus = checkIsAdmin(session.user.email);
        setIsAdmin(adminStatus);

        // Fetch puskesmas list
        const { data: pkmData, error: pkmError } = await supabase
          .from("puskesmas")
          .select("*")
          .neq("code", "KAB")
          .order("name");

        if (pkmError) throw pkmError;
        setPuskesmasList(pkmData || []);

        // Set default period
        setSelectedPeriod(getCurrentPeriod());

        // For non-admin, auto-select their puskesmas
        if (!adminStatus) {
          const emailCode = session.user.email.split("@")[0].toUpperCase();
          setSelectedPuskesmas(emailCode);
        } else {
          setSelectedPuskesmas("all");
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    initData();
  }, [router]);

  // Fetch data when filters change
  useEffect(() => {
    async function fetchData() {
      if (!selectedPeriod || !selectedProgramType) return;

      // Validasi program type
      if (!isValidProgramType(selectedProgramType)) {
        setError(`Program type tidak valid: ${selectedProgramType}`);
        return;
      }

      try {
        setLoadingData(true);

        let query = supabase
          .from("achievements")
          .select("*")
          .neq("puskesmas_code", "KAB");
        
        // Jika BUKAN SEMUA_PROGRAM, filter by program type
        if (selectedProgramType !== PROGRAM_TYPES.SEMUA_PROGRAM) {
          query = query.eq("program_type", selectedProgramType);
        }

        // Handle annual recap vs quarterly
        if (isAnnualPeriod(selectedPeriod)) {
          const parsed = parsePeriod(selectedPeriod);
          const quarters = getQuartersForYear(parsed.year);
          query = query.in("period", quarters);
        } else {
          query = query.eq("period", selectedPeriod);
        }

        if (selectedPuskesmas && selectedPuskesmas !== "all") {
          query = query.eq("puskesmas_code", selectedPuskesmas);
        }

        const { data: achievements, error: achError } = await query
          .order("puskesmas_code")
          .order("indicator_name");

        if (achError) throw achError;
        setData(achievements || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingData(false);
      }
    }

    fetchData();
  }, [selectedPuskesmas, selectedPeriod, selectedProgramType]); // Tambahkan dependency

  // Is showing all puskesmas (recap view)?
  const isRecapView = selectedPuskesmas === "all";

  // Prepare DETAIL report data (single puskesmas) with sorted indicators
  const detailReportData = useMemo(() => {
    if (isRecapView) return [];

    // Group data by indicator (for annual recap, aggregate multiple quarters)
    const indicatorData = {};
    data.forEach((row) => {
      if (!indicatorData[row.indicator_name]) {
        indicatorData[row.indicator_name] = {
          indicator: row.indicator_name,
          unit: row.unit || "Orang",
          target: 0,
          realization: 0,
        };
      }
      // For annual, sum up values from all quarters
      indicatorData[row.indicator_name].target += row.target_qty || 0;
      indicatorData[row.indicator_name].realization += row.realization_qty || 0;
    });

    // Sort by program-specific INDICATOR_ORDER (dinamis)
    return programIndicators.order.filter((name) => indicatorData[name]).map(
      (name, idx) => {
        const d = indicatorData[name];
        const metrics = calculateMetrics(d.target, d.realization);
        return {
          no: idx + 1,
          indicator: name,
          unit: d.unit,
          target: d.target,
          realization: d.realization,
          percentage: metrics.percentage,
          unserved: metrics.unserved,
          status: metrics.isTuntas ? "TUNTAS" : "BELUM TUNTAS",
        };
      },
    );
  }, [data, isRecapView, programIndicators]);

  // Prepare RECAP report data (all puskesmas)
  const recapReportData = useMemo(() => {
    if (!isRecapView) return [];

    const pkmTotals = {};

    // Group by puskesmas
    data.forEach((row) => {
      if (!pkmTotals[row.puskesmas_code]) {
        const pkm = puskesmasList.find((p) => p.code === row.puskesmas_code);
        pkmTotals[row.puskesmas_code] = {
          code: row.puskesmas_code,
          name: pkm?.name || row.puskesmas_code,
          totalTarget: 0,
          totalRealization: 0,
          // Untuk SEMUA_PROGRAM, track per program
          byProgram: {
            USIA_PRODUKTIF: { target: 0, realization: 0 },
            HIPERTENSI: { target: 0, realization: 0 },
            DIABETES: { target: 0, realization: 0 },
            ODGJ: { target: 0, realization: 0 },
          }
        };
      }
      pkmTotals[row.puskesmas_code].totalTarget += row.target_qty || 0;
      pkmTotals[row.puskesmas_code].totalRealization += row.realization_qty || 0;
      
      // Track by program untuk SEMUA_PROGRAM view
      if (row.program_type && pkmTotals[row.puskesmas_code].byProgram[row.program_type]) {
        pkmTotals[row.puskesmas_code].byProgram[row.program_type].target += row.target_qty || 0;
        pkmTotals[row.puskesmas_code].byProgram[row.program_type].realization += row.realization_qty || 0;
      }
    });

    // Calculate metrics and sort
    return Object.values(pkmTotals)
      .map((pkm) => {
        const metrics = calculateMetrics(pkm.totalTarget, pkm.totalRealization);
        // Calculate per program percentages
        const programMetrics = {};
        Object.keys(pkm.byProgram).forEach(prog => {
          const pm = calculateMetrics(pkm.byProgram[prog].target, pkm.byProgram[prog].realization);
          programMetrics[prog] = {
            ...pkm.byProgram[prog],
            percentage: pm.percentage,
            status: pm.isTuntas ? "TUNTAS" : "BELUM"
          };
        });
        return {
          code: pkm.code,
          name: pkm.name,
          totalTarget: pkm.totalTarget,
          totalRealization: pkm.totalRealization,
          percentage: metrics.percentage,
          status: metrics.isTuntas ? "TUNTAS" : "BELUM TUNTAS",
          byProgram: programMetrics,
        };
      })
      .sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage))
      .map((item, idx) => ({ ...item, no: idx + 1 }));
  }, [data, isRecapView, puskesmasList]);

  // Grand totals for recap
  const grandTotal = useMemo(() => {
    if (!isRecapView) return null;

    const total = recapReportData.reduce(
      (acc, row) => ({
        target: acc.target + row.totalTarget,
        realization: acc.realization + row.totalRealization,
      }),
      { target: 0, realization: 0 },
    );

    const metrics = calculateMetrics(total.target, total.realization);
    return {
      ...total,
      percentage: metrics.percentage,
      status: metrics.isTuntas ? "TUNTAS" : "BELUM TUNTAS",
    };
  }, [recapReportData, isRecapView]);

  // Get period label
  const getPeriodLabel = () => {
    return formatPeriodLabel(selectedPeriod);
  };

  // Get selected puskesmas name
  const getSelectedPuskesmasName = () => {
    if (selectedPuskesmas === "all") return "Semua Puskesmas";
    const pkm = puskesmasList.find((p) => p.code === selectedPuskesmas);
    return pkm?.name || selectedPuskesmas;
  };

  // =================================================
  // HELPER: Hitung persentase per kategori (Part A / Part B)
  // Mendukung single program dan SEMUA_PROGRAM
  // =================================================
  const calculateCategoryData = (specificProgramType = null) => {
    const targetProgramType = specificProgramType || selectedProgramType;
    const targetProgramConfig = getProgram(targetProgramType);
    
    // Filter data berdasarkan program type jika spesifik
    const filteredData = specificProgramType 
      ? data.filter(row => row.program_type === specificProgramType)
      : data;
    
    const indicatorData = {};
    filteredData.forEach((row) => {
      if (!indicatorData[row.indicator_name]) {
        indicatorData[row.indicator_name] = {
          indicator: row.indicator_name,
          unit: row.unit || "Orang",
          target: 0,
          realization: 0,
        };
      }
      indicatorData[row.indicator_name].target += row.target_qty || 0;
      indicatorData[row.indicator_name].realization += row.realization_qty || 0;
    });

    // Kategori Part A (Layanan Dasar - 80%)
    const partA = targetProgramConfig.indicators?.partA || [];
    // Kategori Part B - Barang
    const partBBarang = targetProgramConfig.indicators?.partBBarang || [];
    // Kategori Part B - SDM
    const partBSDM = targetProgramConfig.indicators?.partBSDM || [];

    // Hitung total Part A
    let partATarget = 0, partAReal = 0;
    partA.forEach(name => {
      if (indicatorData[name]) {
        partATarget += indicatorData[name].target;
        partAReal += indicatorData[name].realization;
      }
    });
    const partAPercent = partATarget > 0 ? ((partAReal / partATarget) * 100).toFixed(2) : "0.00";

    // Hitung total Part B Barang
    let partBBarangTarget = 0, partBBarangReal = 0;
    partBBarang.forEach(name => {
      if (indicatorData[name]) {
        partBBarangTarget += indicatorData[name].target;
        partBBarangReal += indicatorData[name].realization;
      }
    });

    // Hitung total Part B SDM
    let partBSDMTarget = 0, partBSDMReal = 0;
    partBSDM.forEach(name => {
      if (indicatorData[name]) {
        partBSDMTarget += indicatorData[name].target;
        partBSDMReal += indicatorData[name].realization;
      }
    });

    // Total Part B
    const partBTarget = partBBarangTarget + partBSDMTarget;
    const partBReal = partBBarangReal + partBSDMReal;
    const partBPercent = partBTarget > 0 ? ((partBReal / partBTarget) * 100).toFixed(2) : "0.00";

    return {
      indicatorData,
      partA: { target: partATarget, realization: partAReal, percentage: partAPercent },
      partBBarang: { target: partBBarangTarget, realization: partBBarangReal },
      partBSDM: { target: partBSDMTarget, realization: partBSDMReal },
      partB: { target: partBTarget, realization: partBReal, percentage: partBPercent },
    };
  };

  // =================================================
  // Export to Excel - FORMAT SPM KEMENDAGRI
  // Struktur: Section A (80%) dan Section B (20%)
  // SEMUA_PROGRAM: 4 Section terpisah per penyakit
  // =================================================
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const isSemua = selectedProgramType === PROGRAM_TYPES.SEMUA_PROGRAM;
      
      // List 4 program untuk SEMUA_PROGRAM
      const PROGRAM_LIST = ['USIA_PRODUKTIF', 'HIPERTENSI', 'DIABETES', 'ODGJ'];

      // ============================================
      // BUILD EXCEL ROWS SESUAI FORMAT SPM KEMENDAGRI
      // ============================================
      const rows = [];
      
      // KOP SURAT
      rows.push(["PEMERINTAH KABUPATEN MOROWALI UTARA"]);
      rows.push(["DINAS KESEHATAN DAERAH"]);
      rows.push(["CAPAIAN STANDAR PELAYANAN MINIMAL (SPM) BIDANG KESEHATAN"]);
      rows.push([`PERIODE: ${getPeriodLabel()}`]);
      rows.push([""]);
      
      if (isRecapView) {
        // ============================================
        // MODE REKAP - Rekapitulasi Seluruh Puskesmas
        // ============================================
        
        if (isSemua) {
          // ============================================
          // FORMAT SEMUA PROGRAM - 4 SECTION TERPISAH
          // ============================================
          rows.push(["REKAPITULASI CAPAIAN SPM BIDANG KESEHATAN - SELURUH PUSKESMAS"]);
          rows.push([""]);
          
          // Loop untuk setiap program (4 section terpisah)
          PROGRAM_LIST.forEach((progType, progIdx) => {
            const prog = getProgram(progType);
            
            rows.push(["═══════════════════════════════════════════════════════════════════════════════════════"]);
            rows.push([`SECTION ${progIdx + 1}: ${prog.description?.toUpperCase() || prog.label.toUpperCase()}`]);
            rows.push(["═══════════════════════════════════════════════════════════════════════════════════════"]);
            rows.push([""]);
            
            // Header Table per program
            rows.push(["No", "Nama Puskesmas", "Kode", "Sasaran", "Realisasi", "% Capaian", "Status"]);
            
            // Data per Puskesmas untuk program ini
            let progTotal = { target: 0, realization: 0 };
            recapReportData.forEach((row) => {
              const progData = row.byProgram?.[progType] || { target: 0, realization: 0, percentage: "0.00", status: "BELUM" };
              progTotal.target += progData.target || 0;
              progTotal.realization += progData.realization || 0;
              
              rows.push([
                row.no,
                row.name,
                row.code,
                progData.target || 0,
                progData.realization || 0,
                `${progData.percentage || "0.00"}%`,
                progData.status === "TUNTAS" ? "TUNTAS" : "BELUM TUNTAS"
              ]);
            });
            
            // Subtotal per program
            const progPercent = progTotal.target > 0 ? ((progTotal.realization / progTotal.target) * 100).toFixed(2) : "0.00";
            rows.push([""]);
            rows.push([
              "",
              `TOTAL ${prog.shortLabel.toUpperCase()}`,
              "",
              progTotal.target,
              progTotal.realization,
              `${progPercent}%`,
              parseFloat(progPercent) >= 80 ? "TUNTAS" : "BELUM TUNTAS"
            ]);
            rows.push([""]);
            rows.push([""]);
          });
          
        } else {
          // ============================================
          // FORMAT PROGRAM TUNGGAL - Tabel standar
          // ============================================
          rows.push([`REKAPITULASI ${programConfig.label.toUpperCase()} - SELURUH PUSKESMAS`]);
          rows.push([""]);
          
          // Header Table Rekap
          rows.push(["No", "Nama Puskesmas", "Kode", "Sasaran", "Realisasi", "% Capaian", "Status"]);
          
          // Data per Puskesmas
          recapReportData.forEach((row) => {
            rows.push([
              row.no,
              row.name,
              row.code,
              row.totalTarget,
              row.totalRealization,
              `${row.percentage}%`,
              row.status
            ]);
          });
          
          // Grand Total
          rows.push([""]);
          rows.push([
            "",
            "TOTAL KABUPATEN MOROWALI UTARA",
            "",
            grandTotal?.target || 0,
            grandTotal?.realization || 0,
            `${grandTotal?.percentage || "0.00"}%`,
            grandTotal?.status || "BELUM TUNTAS"
          ]);
        }
        
      } else {
        // ============================================
        // MODE DETAIL - Per Puskesmas
        // ============================================
        const pkmName = getSelectedPuskesmasName();
        
        if (isSemua) {
          // ============================================
          // SEMUA_PROGRAM: 4 SECTION TERPISAH per penyakit
          // ============================================
          rows.push([`LAPORAN DETAIL CAPAIAN SPM - PUSKESMAS ${pkmName.toUpperCase()}`]);
          rows.push([""]);
          
          // Loop untuk setiap program (4 section terpisah)
          PROGRAM_LIST.forEach((progType, progIdx) => {
            const prog = getProgram(progType);
            const catData = calculateCategoryData(progType);
            
            rows.push(["═══════════════════════════════════════════════════════════════════════════════════════"]);
            rows.push([`SECTION ${progIdx + 1}: ${prog.description?.toUpperCase() || prog.label.toUpperCase()}`]);
            rows.push(["═══════════════════════════════════════════════════════════════════════════════════════"]);
            rows.push([""]);
            
            // SECTION A - LAYANAN DASAR (80%)
            rows.push(["PERSENTASE PENCAPAIAN PENERIMAAN LAYANAN DASAR (80%)"]);
            rows.push([""]);
            rows.push(["A. JUMLAH YANG HARUS DILAYANI"]);
            rows.push(["No", "Indikator", "Satuan", "Sasaran", "Realisasi", "% Capaian", "Status"]);
            
            const partAIndicators = prog.indicators?.partA || [];
            let noA = 1;
            partAIndicators.forEach(indicatorName => {
              const d = catData.indicatorData[indicatorName];
              if (d) {
                const pct = d.target > 0 ? ((d.realization / d.target) * 100).toFixed(2) : "0.00";
                const status = parseFloat(pct) >= 80 ? "TUNTAS" : "BELUM TUNTAS";
                rows.push([noA++, indicatorName, d.unit, d.target, d.realization, `${pct}%`, status]);
              }
            });
            
            rows.push([""]);
            rows.push(["", "SUBTOTAL LAYANAN DASAR (A)", "", catData.partA.target, catData.partA.realization, `${catData.partA.percentage}%`, parseFloat(catData.partA.percentage) >= 80 ? "TUNTAS" : "BELUM TUNTAS"]);
            rows.push([""]);
            
            // SECTION B - MUTU MINIMAL (20%)
            rows.push(["PERSENTASE PENCAPAIAN MUTU MINIMAL LAYANAN DASAR (20%)"]);
            rows.push([""]);
            
            // B.1 BARANG/JASA
            rows.push(["B.1 BARANG / JASA"]);
            rows.push(["No", "Indikator", "Satuan", "Target", "Realisasi", "% Capaian", "Status"]);
            
            const partBBarangIndicators = prog.indicators?.partBBarang || [];
            let noB1 = 1;
            partBBarangIndicators.forEach(indicatorName => {
              const d = catData.indicatorData[indicatorName];
              if (d) {
                const pct = d.target > 0 ? ((d.realization / d.target) * 100).toFixed(2) : "0.00";
                rows.push([noB1++, indicatorName, d.unit, d.target, d.realization, `${pct}%`, parseFloat(pct) >= 80 ? "✓" : "✗"]);
              }
            });
            rows.push([""]);
            
            // B.2 SDM
            rows.push(["B.2 SUMBER DAYA MANUSIA (SDM)"]);
            rows.push(["No", "Indikator", "Satuan", "Target", "Realisasi", "% Capaian", "Status"]);
            
            const partBSDMIndicators = prog.indicators?.partBSDM || [];
            let noB2 = 1;
            partBSDMIndicators.forEach(indicatorName => {
              const d = catData.indicatorData[indicatorName];
              if (d) {
                const pct = d.target > 0 ? ((d.realization / d.target) * 100).toFixed(2) : "0.00";
                rows.push([noB2++, indicatorName, d.unit, d.target, d.realization, `${pct}%`, parseFloat(pct) >= 80 ? "✓" : "✗"]);
              }
            });
            
            rows.push([""]);
            rows.push(["", "SUBTOTAL MUTU MINIMAL (B)", "", catData.partB.target, catData.partB.realization, `${catData.partB.percentage}%`, parseFloat(catData.partB.percentage) >= 80 ? "TUNTAS" : "BELUM TUNTAS"]);
            rows.push([""]);
            
            // SUMMARY per program
            const nilaiA = (parseFloat(catData.partA.percentage) * 0.8).toFixed(2);
            const nilaiB = (parseFloat(catData.partB.percentage) * 0.2).toFixed(2);
            const totalNilai = (parseFloat(nilaiA) + parseFloat(nilaiB)).toFixed(2);
            
            rows.push(["REKAPITULASI NILAI AKHIR"]);
            rows.push(["Komponen", "Bobot", "Capaian (%)", "Nilai Tertimbang"]);
            rows.push(["A. Layanan Dasar", "80%", `${catData.partA.percentage}%`, nilaiA]);
            rows.push(["B. Mutu Minimal", "20%", `${catData.partB.percentage}%`, nilaiB]);
            rows.push(["TOTAL NILAI SPM", "100%", "", totalNilai]);
            rows.push(["STATUS", "", "", parseFloat(totalNilai) >= 80 ? "TUNTAS" : "BELUM TUNTAS"]);
            rows.push([""]);
            rows.push([""]);
          });
          
        } else {
          // ============================================
          // PROGRAM TUNGGAL: Format Section A & B standar
          // ============================================
          const catData = calculateCategoryData();
          
          rows.push([`JENIS PELAYANAN DASAR: ${programConfig.description?.toUpperCase() || programConfig.label.toUpperCase()}`]);
          rows.push([`PUSKESMAS: ${pkmName.toUpperCase()}`]);
          rows.push([""]);
          
          // SECTION A
          rows.push(["═══════════════════════════════════════════════════════════════════════════════════════"]);
          rows.push(["PERSENTASE PENCAPAIAN PENERIMAAN LAYANAN DASAR (80%)"]);
          rows.push(["═══════════════════════════════════════════════════════════════════════════════════════"]);
          rows.push([""]);
          rows.push(["A. JUMLAH YANG HARUS DILAYANI"]);
          rows.push(["No", "Indikator", "Satuan", "Sasaran", "Realisasi", "% Capaian", "Status"]);
          
          const partAIndicators = programConfig.indicators?.partA || [];
          let noA = 1;
          partAIndicators.forEach(indicatorName => {
            const d = catData.indicatorData[indicatorName];
            if (d) {
              const pct = d.target > 0 ? ((d.realization / d.target) * 100).toFixed(2) : "0.00";
              rows.push([noA++, indicatorName, d.unit, d.target, d.realization, `${pct}%`, parseFloat(pct) >= 80 ? "TUNTAS" : "BELUM TUNTAS"]);
            }
          });
          
          rows.push([""]);
          rows.push(["", "TOTAL LAYANAN DASAR (A)", "", catData.partA.target, catData.partA.realization, `${catData.partA.percentage}%`, parseFloat(catData.partA.percentage) >= 80 ? "TUNTAS" : "BELUM TUNTAS"]);
          rows.push([""]);
          
          // SECTION B
          rows.push(["═══════════════════════════════════════════════════════════════════════════════════════"]);
          rows.push(["PERSENTASE PENCAPAIAN MUTU MINIMAL LAYANAN DASAR (20%)"]);
          rows.push(["═══════════════════════════════════════════════════════════════════════════════════════"]);
          rows.push([""]);
          rows.push(["B. JUMLAH BARANG / JASA / SDM YANG HARUS DISIAPKAN"]);
          rows.push([""]);
          
          // B.1 BARANG/JASA
          rows.push(["B.1 BARANG / JASA"]);
          rows.push(["No", "Indikator Barang/Jasa", "Satuan", "Target", "Realisasi", "% Capaian", "Status"]);
          
          const partBBarangIndicators = programConfig.indicators?.partBBarang || [];
          let noB1 = 1;
          partBBarangIndicators.forEach(indicatorName => {
            const d = catData.indicatorData[indicatorName];
            if (d) {
              const pct = d.target > 0 ? ((d.realization / d.target) * 100).toFixed(2) : "0.00";
              rows.push([noB1++, indicatorName, d.unit, d.target, d.realization, `${pct}%`, parseFloat(pct) >= 80 ? "✓" : "✗"]);
            }
          });
          rows.push([""]);
          
          // B.2 SDM
          rows.push(["B.2 SUMBER DAYA MANUSIA (SDM)"]);
          rows.push(["No", "Indikator SDM", "Satuan", "Target", "Realisasi", "% Capaian", "Status"]);
          
          const partBSDMIndicators = programConfig.indicators?.partBSDM || [];
          let noB2 = 1;
          partBSDMIndicators.forEach(indicatorName => {
            const d = catData.indicatorData[indicatorName];
            if (d) {
              const pct = d.target > 0 ? ((d.realization / d.target) * 100).toFixed(2) : "0.00";
              rows.push([noB2++, indicatorName, d.unit, d.target, d.realization, `${pct}%`, parseFloat(pct) >= 80 ? "✓" : "✗"]);
            }
          });
          
          rows.push([""]);
          rows.push(["", "TOTAL MUTU MINIMAL (B)", "", catData.partB.target, catData.partB.realization, `${catData.partB.percentage}%`, parseFloat(catData.partB.percentage) >= 80 ? "TUNTAS" : "BELUM TUNTAS"]);
          rows.push([""]);
          
          // GRAND SUMMARY
          rows.push(["═══════════════════════════════════════════════════════════════════════════════════════"]);
          rows.push(["REKAPITULASI CAPAIAN SPM"]);
          rows.push(["═══════════════════════════════════════════════════════════════════════════════════════"]);
          rows.push([""]);
          rows.push(["Komponen", "Bobot", "Capaian (%)", "Nilai Tertimbang"]);
          
          const nilaiA = (parseFloat(catData.partA.percentage) * 0.8).toFixed(2);
          const nilaiB = (parseFloat(catData.partB.percentage) * 0.2).toFixed(2);
          const totalNilai = (parseFloat(nilaiA) + parseFloat(nilaiB)).toFixed(2);
          
          rows.push(["A. Layanan Dasar", "80%", `${catData.partA.percentage}%`, nilaiA]);
          rows.push(["B. Mutu Minimal", "20%", `${catData.partB.percentage}%`, nilaiB]);
          rows.push([""]);
          rows.push(["TOTAL NILAI AKHIR SPM", "100%", "", totalNilai]);
          rows.push(["STATUS", "", "", parseFloat(totalNilai) >= 80 ? "TUNTAS" : "BELUM TUNTAS"]);
        }
      }
      
      // FOOTER
      rows.push([""]);
      rows.push([""]);
      rows.push(["Keterangan:"]);
      rows.push(["- Standar SPM: ≥80% = TUNTAS"]);
      rows.push(["- Target Capaian: 100%"]);
      rows.push(["- Bobot Layanan Dasar: 80%, Bobot Mutu Minimal: 20%"]);
      rows.push([""]);
      rows.push([`Dicetak pada: ${new Date().toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" })}`]);

      // CREATE WORKSHEET
      const ws = XLSX.utils.aoa_to_sheet(rows);

      // Set column widths
      ws["!cols"] = [
        { wch: 5 },   // No
        { wch: 60 },  // Indikator/Nama
        { wch: 12 },  // Satuan/Kode
        { wch: 14 },  // Target/Sasaran
        { wch: 14 },  // Realisasi
        { wch: 14 },  // % Capaian
        { wch: 15 },  // Status
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        wb,
        ws,
        isRecapView ? "Rekap SPM" : "Detail SPM",
      );

      // Filename dengan format SPM
      const filename = isRecapView
        ? `SPM_REKAP_${selectedProgramType}_Kabupaten_${selectedPeriod}.xlsx`
        : `SPM_DETAIL_${selectedProgramType}_${selectedPuskesmas}_${selectedPeriod}.xlsx`;

      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error("Export Excel error:", err);
      setError("Gagal mengekspor ke Excel: " + err.message);
    } finally {
      setExporting(false);
    }
  };

  // =================================================
  // Export to PDF - FORMAT RESMI SPM DINKES
  // Dengan Kop Surat dan Struktur Section A/B
  // SEMUA_PROGRAM: 4 Section terpisah per penyakit
  // =================================================
  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const isSemua = selectedProgramType === PROGRAM_TYPES.SEMUA_PROGRAM;
      
      // List 4 program untuk SEMUA_PROGRAM
      const PROGRAM_LIST = ['USIA_PRODUKTIF', 'HIPERTENSI', 'DIABETES', 'ODGJ'];
      const PROGRAM_COLORS = {
        USIA_PRODUKTIF: [2, 132, 199],   // sky-600
        HIPERTENSI: [225, 29, 72],       // rose-600
        DIABETES: [5, 150, 105],         // emerald-600
        ODGJ: [124, 58, 237],            // violet-600
      };

      const doc = new jsPDF(isRecapView ? "landscape" : "portrait", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // ============================================
      // KOP SURAT RESMI PEMERINTAH DAERAH
      // ============================================
      const addKopSurat = () => {
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("PEMERINTAH KABUPATEN MOROWALI UTARA", pageWidth / 2, 15, {
          align: "center",
        });

        doc.setFontSize(16);
        doc.text("DINAS KESEHATAN DAERAH", pageWidth / 2, 22, { align: "center" });

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(
          "Jl. Trans Sulawesi, Kolonodale - Sulawesi Tengah, Kode Pos 94671",
          pageWidth / 2,
          28,
          { align: "center" },
        );
        doc.text(
          "Telp/Fax: (0465) XXXXXX | Email: dinkes@morowaliutarakab.go.id",
          pageWidth / 2,
          33,
          { align: "center" },
        );

        // Double Line Separator (Kop Surat Style)
        doc.setLineWidth(1.2);
        doc.line(14, 37, pageWidth - 14, 37);
        doc.setLineWidth(0.4);
        doc.line(14, 38.5, pageWidth - 14, 38.5);
      };

      addKopSurat();

      // ============================================
      // JUDUL DOKUMEN
      // ============================================
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(
        "CAPAIAN STANDAR PELAYANAN MINIMAL (SPM) BIDANG KESEHATAN",
        pageWidth / 2,
        47,
        { align: "center" },
      );
      
      if (isSemua) {
        doc.text("REKAPITULASI SELURUH JENIS SPM", pageWidth / 2, 53, { align: "center" });
      } else {
        doc.text(
          `${programConfig.description?.toUpperCase() || programConfig.label.toUpperCase()}`,
          pageWidth / 2,
          53,
          { align: "center" },
        );
      }

      // Periode Info
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Periode: ${getPeriodLabel()}`, pageWidth / 2, 60, { align: "center" });

      let currentY = 68;

      if (isRecapView) {
        // ============================================
        // MODE REKAP - TABEL REKAPITULASI KABUPATEN
        // ============================================
        
        if (isSemua) {
          // ============================================
          // SEMUA_PROGRAM: 4 SECTION TERPISAH per program
          // ============================================
          for (let progIdx = 0; progIdx < PROGRAM_LIST.length; progIdx++) {
            const progType = PROGRAM_LIST[progIdx];
            const prog = getProgram(progType);
            const progColor = PROGRAM_COLORS[progType];
            
            // Add new page if needed (except first)
            if (progIdx > 0) {
              doc.addPage();
              addKopSurat();
              currentY = 48;
            }
            
            // Section Header
            doc.setFillColor(...progColor);
            doc.rect(14, currentY, pageWidth - 28, 8, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.text(`SECTION ${progIdx + 1}: ${prog.description?.toUpperCase() || prog.label.toUpperCase()}`, 16, currentY + 5.5);
            doc.setTextColor(0, 0, 0);
            currentY += 12;
            
            // Build table data for this program
            const tableData = recapReportData.map((row) => {
              const progData = row.byProgram?.[progType] || { target: 0, realization: 0, percentage: "0.00", status: "BELUM" };
              return [
                row.no,
                row.name,
                row.code,
                (progData.target || 0).toLocaleString("id-ID"),
                (progData.realization || 0).toLocaleString("id-ID"),
                `${progData.percentage || "0.00"}%`,
                progData.status === "TUNTAS" ? "TUNTAS" : "BELUM TUNTAS"
              ];
            });
            
            // Calculate program total
            let progTotalTarget = 0, progTotalReal = 0;
            recapReportData.forEach(row => {
              const progData = row.byProgram?.[progType] || { target: 0, realization: 0 };
              progTotalTarget += progData.target || 0;
              progTotalReal += progData.realization || 0;
            });
            const progPercent = progTotalTarget > 0 ? ((progTotalReal / progTotalTarget) * 100).toFixed(2) : "0.00";
            
            autoTable(doc, {
              startY: currentY,
              head: [["No", "Nama Puskesmas", "Kode", "Sasaran", "Realisasi", "% Capaian", "Status"]],
              body: tableData,
              foot: [[
                "",
                `TOTAL ${prog.shortLabel.toUpperCase()}`,
                "",
                progTotalTarget.toLocaleString("id-ID"),
                progTotalReal.toLocaleString("id-ID"),
                `${progPercent}%`,
                parseFloat(progPercent) >= 80 ? "TUNTAS" : "BELUM TUNTAS"
              ]],
              theme: "grid",
              headStyles: { fillColor: progColor, fontSize: 8, halign: "center", fontStyle: "bold" },
              bodyStyles: { fontSize: 7 },
              footStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold" },
              columnStyles: {
                0: { halign: "center", cellWidth: 10 },
                1: { cellWidth: 50 },
                2: { halign: "center", cellWidth: 15 },
                3: { halign: "right", cellWidth: 25 },
                4: { halign: "right", cellWidth: 25 },
                5: { halign: "center", cellWidth: 22 },
                6: { halign: "center", cellWidth: 25 },
              },
              didParseCell: function (data) {
                if (data.column.index === 6 && data.section === "body") {
                  data.cell.styles.textColor = data.cell.raw === "TUNTAS" ? [5, 150, 105] : [220, 38, 38];
                  data.cell.styles.fontStyle = "bold";
                }
              },
            });
            
            currentY = doc.lastAutoTable.finalY + 10;
          }
          
        } else {
          // ============================================
          // PROGRAM TUNGGAL - Format standar
          // ============================================
          const catData = calculateCategoryData();
          
          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.text("REKAPITULASI SELURUH PUSKESMAS", 14, currentY);
          currentY += 6;

          const tableData = recapReportData.map((row) => [
            row.no,
            row.name,
            row.code,
            row.totalTarget.toLocaleString("id-ID"),
            row.totalRealization.toLocaleString("id-ID"),
            `${row.percentage}%`,
            row.status,
          ]);

          autoTable(doc, {
            startY: currentY,
            head: [["No", "Nama Puskesmas", "Kode", "Sasaran", "Realisasi", "% Capaian", "Status"]],
            body: tableData,
            foot: grandTotal ? [[
              "",
              "TOTAL KABUPATEN",
              "",
              grandTotal.target.toLocaleString("id-ID"),
              grandTotal.realization.toLocaleString("id-ID"),
              `${grandTotal.percentage}%`,
              grandTotal.status,
            ]] : [],
            theme: "grid",
            headStyles: { fillColor: [30, 58, 138], fontSize: 9, halign: "center", fontStyle: "bold" },
            bodyStyles: { fontSize: 8 },
            footStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontSize: 9, fontStyle: "bold" },
            columnStyles: {
              0: { halign: "center", cellWidth: 12 },
              1: { cellWidth: 55 },
              2: { halign: "center", cellWidth: 18 },
              3: { halign: "right", cellWidth: 28 },
              4: { halign: "right", cellWidth: 28 },
              5: { halign: "center", cellWidth: 25 },
              6: { halign: "center", cellWidth: 28 },
            },
            didParseCell: function (data) {
              if (data.column.index === 6 && data.section === "body") {
                data.cell.styles.textColor = data.cell.raw === "TUNTAS" ? [5, 150, 105] : [220, 38, 38];
                data.cell.styles.fontStyle = "bold";
              }
            },
          });
        }

      } else {
        // ============================================
        // MODE DETAIL - FORMAT SPM SECTION A & B
        // ============================================
        const pkmName = getSelectedPuskesmasName();
        
        if (isSemua) {
          // ============================================
          // SEMUA_PROGRAM: 4 SECTION TERPISAH per penyakit
          // ============================================
          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.text(`PUSKESMAS: ${pkmName.toUpperCase()}`, 14, currentY);
          currentY += 8;
          
          for (let progIdx = 0; progIdx < PROGRAM_LIST.length; progIdx++) {
            const progType = PROGRAM_LIST[progIdx];
            const prog = getProgram(progType);
            const catData = calculateCategoryData(progType);
            const progColor = PROGRAM_COLORS[progType];
            
            // Add new page if needed
            if (currentY > pageHeight - 100) {
              doc.addPage();
              currentY = 20;
            }
            
            // Section Header
            doc.setFillColor(...progColor);
            doc.rect(14, currentY, pageWidth - 28, 8, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text(`SECTION ${progIdx + 1}: ${prog.description?.toUpperCase() || prog.label.toUpperCase()}`, 16, currentY + 5.5);
            doc.setTextColor(0, 0, 0);
            currentY += 12;
            
            // Part A - Layanan Dasar
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text("A. PENERIMAAN LAYANAN DASAR (80%)", 14, currentY);
            currentY += 4;
            
            const partAIndicators = prog.indicators?.partA || [];
            const partAData = partAIndicators.map((name, idx) => {
              const d = catData.indicatorData[name];
              if (d) {
                const pct = d.target > 0 ? ((d.realization / d.target) * 100).toFixed(2) : "0.00";
                return [idx + 1, name, d.unit, d.target.toLocaleString("id-ID"), d.realization.toLocaleString("id-ID"), `${pct}%`];
              }
              return [idx + 1, name, "-", "0", "0", "0%"];
            });
            
            autoTable(doc, {
              startY: currentY,
              head: [["No", "Indikator", "Satuan", "Sasaran", "Realisasi", "% Capaian"]],
              body: partAData,
              foot: [["", "SUBTOTAL (A)", "", catData.partA.target.toLocaleString("id-ID"), catData.partA.realization.toLocaleString("id-ID"), `${catData.partA.percentage}%`]],
              theme: "grid",
              headStyles: { fillColor: [100, 116, 139], fontSize: 7, halign: "center" },
              bodyStyles: { fontSize: 7 },
              footStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontSize: 7, fontStyle: "bold" },
              columnStyles: {
                0: { halign: "center", cellWidth: 8 },
                1: { cellWidth: 50 },
                2: { halign: "center", cellWidth: 15 },
                3: { halign: "right", cellWidth: 18 },
                4: { halign: "right", cellWidth: 18 },
                5: { halign: "center", cellWidth: 18 },
              },
            });
            
            currentY = doc.lastAutoTable.finalY + 4;
            
            // Part B - Mutu Minimal (simplified for PDF)
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text("B. MUTU MINIMAL LAYANAN DASAR (20%)", 14, currentY);
            currentY += 4;
            
            const partBBarang = prog.indicators?.partBBarang || [];
            const partBSDM = prog.indicators?.partBSDM || [];
            const partBData = [...partBBarang, ...partBSDM].map((name, idx) => {
              const d = catData.indicatorData[name];
              if (d) {
                const pct = d.target > 0 ? ((d.realization / d.target) * 100).toFixed(2) : "0.00";
                return [idx + 1, name, d.unit, d.target.toLocaleString("id-ID"), d.realization.toLocaleString("id-ID"), `${pct}%`];
              }
              return [idx + 1, name, "-", "0", "0", "0%"];
            });
            
            autoTable(doc, {
              startY: currentY,
              head: [["No", "Indikator Barang/Jasa/SDM", "Satuan", "Target", "Realisasi", "% Capaian"]],
              body: partBData,
              foot: [["", "SUBTOTAL (B)", "", catData.partB.target.toLocaleString("id-ID"), catData.partB.realization.toLocaleString("id-ID"), `${catData.partB.percentage}%`]],
              theme: "grid",
              headStyles: { fillColor: progColor, fontSize: 7, halign: "center" },
              bodyStyles: { fontSize: 6 },
              footStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontSize: 7, fontStyle: "bold" },
              columnStyles: {
                0: { halign: "center", cellWidth: 8 },
                1: { cellWidth: 50 },
                2: { halign: "center", cellWidth: 15 },
                3: { halign: "right", cellWidth: 18 },
                4: { halign: "right", cellWidth: 18 },
                5: { halign: "center", cellWidth: 18 },
              },
            });
            
            currentY = doc.lastAutoTable.finalY + 4;
            
            // Summary per program
            const nilaiA = (parseFloat(catData.partA.percentage) * 0.8).toFixed(2);
            const nilaiB = (parseFloat(catData.partB.percentage) * 0.2).toFixed(2);
            const totalNilai = (parseFloat(nilaiA) + parseFloat(nilaiB)).toFixed(2);
            const statusFinal = parseFloat(totalNilai) >= 80 ? "TUNTAS" : "BELUM TUNTAS";
            
            autoTable(doc, {
              startY: currentY,
              head: [["Komponen", "Bobot", "Capaian", "Nilai"]],
              body: [
                ["A. Layanan Dasar", "80%", `${catData.partA.percentage}%`, nilaiA],
                ["B. Mutu Minimal", "20%", `${catData.partB.percentage}%`, nilaiB],
              ],
              foot: [["NILAI AKHIR", "100%", statusFinal, totalNilai]],
              theme: "grid",
              headStyles: { fillColor: [30, 41, 59], fontSize: 7, halign: "center" },
              bodyStyles: { fontSize: 7 },
              footStyles: { 
                fillColor: statusFinal === "TUNTAS" ? [5, 150, 105] : [220, 38, 38], 
                textColor: [255, 255, 255], 
                fontSize: 8, 
                fontStyle: "bold" 
              },
              columnStyles: {
                0: { cellWidth: 35 },
                1: { halign: "center", cellWidth: 18 },
                2: { halign: "center", cellWidth: 22 },
                3: { halign: "center", cellWidth: 18 },
              },
            });
            
            currentY = doc.lastAutoTable.finalY + 12;
          }
          
        } else {
          // ============================================
          // PROGRAM TUNGGAL - Format Section A & B lengkap
          // ============================================
          const catData = calculateCategoryData();
          
          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.text(`PUSKESMAS: ${pkmName.toUpperCase()}`, 14, currentY);
          currentY += 8;

          // SECTION A - LAYANAN DASAR (80%)
          doc.setFillColor(30, 58, 138);
          doc.rect(14, currentY, pageWidth - 28, 7, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(10);
          doc.text("PERSENTASE PENCAPAIAN PENERIMAAN LAYANAN DASAR (80%)", 16, currentY + 5);
          doc.setTextColor(0, 0, 0);
          currentY += 10;

          // A. JUMLAH YANG HARUS DILAYANI
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.text("A. JUMLAH YANG HARUS DILAYANI", 14, currentY);
          currentY += 4;

          const partAIndicators = programConfig.indicators?.partA || [];
          const partAData = partAIndicators.map((name, idx) => {
            const d = catData.indicatorData[name];
            if (d) {
              const pct = d.target > 0 ? ((d.realization / d.target) * 100).toFixed(2) : "0.00";
              const status = parseFloat(pct) >= 80 ? "TUNTAS" : "BELUM";
              return [idx + 1, name, d.unit, d.target.toLocaleString("id-ID"), d.realization.toLocaleString("id-ID"), `${pct}%`, status];
            }
            return [idx + 1, name, "-", "0", "0", "0%", "N/A"];
          });

          autoTable(doc, {
            startY: currentY,
            head: [["No", "Indikator", "Satuan", "Sasaran", "Realisasi", "% Capaian", "Status"]],
            body: partAData,
            foot: [["", "SUBTOTAL LAYANAN DASAR (A)", "", catData.partA.target.toLocaleString("id-ID"), catData.partA.realization.toLocaleString("id-ID"), `${catData.partA.percentage}%`, parseFloat(catData.partA.percentage) >= 80 ? "TUNTAS" : "BELUM"]],
            theme: "grid",
            headStyles: { fillColor: [100, 116, 139], fontSize: 8, halign: "center" },
            bodyStyles: { fontSize: 8 },
            footStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold" },
            columnStyles: {
              0: { halign: "center", cellWidth: 10 },
              1: { cellWidth: 55 },
              2: { halign: "center", cellWidth: 18 },
              3: { halign: "right", cellWidth: 22 },
              4: { halign: "right", cellWidth: 22 },
              5: { halign: "center", cellWidth: 20 },
              6: { halign: "center", cellWidth: 20 },
            },
            didParseCell: function (data) {
              if (data.column.index === 6 && (data.section === "body" || data.section === "foot")) {
                data.cell.styles.textColor = data.cell.raw === "TUNTAS" ? [5, 150, 105] : [220, 38, 38];
                data.cell.styles.fontStyle = "bold";
              }
            },
          });

          currentY = doc.lastAutoTable.finalY + 8;

          // SECTION B - MUTU MINIMAL (20%)
          doc.setFillColor(16, 185, 129);
          doc.rect(14, currentY, pageWidth - 28, 7, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.text("PERSENTASE PENCAPAIAN MUTU MINIMAL LAYANAN DASAR (20%)", 16, currentY + 5);
          doc.setTextColor(0, 0, 0);
          currentY += 10;

          // B.1 BARANG / JASA
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.text("B.1 BARANG / JASA", 14, currentY);
          currentY += 4;

          const partBBarangIndicators = programConfig.indicators?.partBBarang || [];
          const partBBarangData = partBBarangIndicators.map((name, idx) => {
            const d = catData.indicatorData[name];
            if (d) {
              const pct = d.target > 0 ? ((d.realization / d.target) * 100).toFixed(2) : "0.00";
              return [idx + 1, name, d.unit, d.target.toLocaleString("id-ID"), d.realization.toLocaleString("id-ID"), `${pct}%`];
            }
            return [idx + 1, name, "-", "0", "0", "0%"];
          });

          autoTable(doc, {
            startY: currentY,
            head: [["No", "Indikator Barang/Jasa", "Satuan", "Target", "Realisasi", "% Capaian"]],
            body: partBBarangData,
            theme: "grid",
            headStyles: { fillColor: [5, 150, 105], fontSize: 8, halign: "center" },
            bodyStyles: { fontSize: 7 },
            columnStyles: {
              0: { halign: "center", cellWidth: 10 },
              1: { cellWidth: 60 },
              2: { halign: "center", cellWidth: 18 },
              3: { halign: "right", cellWidth: 20 },
              4: { halign: "right", cellWidth: 20 },
              5: { halign: "center", cellWidth: 20 },
            },
          });

          currentY = doc.lastAutoTable.finalY + 6;

          // Check if need new page
          if (currentY > pageHeight - 80) {
            doc.addPage();
            currentY = 20;
          }

          // B.2 SDM
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.text("B.2 SUMBER DAYA MANUSIA (SDM)", 14, currentY);
          currentY += 4;

          const partBSDMIndicators = programConfig.indicators?.partBSDM || [];
          const partBSDMData = partBSDMIndicators.map((name, idx) => {
            const d = catData.indicatorData[name];
            if (d) {
              const pct = d.target > 0 ? ((d.realization / d.target) * 100).toFixed(2) : "0.00";
              return [idx + 1, name, d.unit, d.target.toLocaleString("id-ID"), d.realization.toLocaleString("id-ID"), `${pct}%`];
            }
            return [idx + 1, name, "-", "0", "0", "0%"];
          });

          autoTable(doc, {
            startY: currentY,
            head: [["No", "Indikator SDM", "Satuan", "Target", "Realisasi", "% Capaian"]],
            body: partBSDMData,
            foot: [["", "SUBTOTAL MUTU MINIMAL (B)", "", catData.partB.target.toLocaleString("id-ID"), catData.partB.realization.toLocaleString("id-ID"), `${catData.partB.percentage}%`]],
            theme: "grid",
            headStyles: { fillColor: [124, 58, 237], fontSize: 8, halign: "center" },
            bodyStyles: { fontSize: 7 },
            footStyles: { fillColor: [109, 40, 217], textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold" },
            columnStyles: {
              0: { halign: "center", cellWidth: 10 },
              1: { cellWidth: 60 },
              2: { halign: "center", cellWidth: 18 },
              3: { halign: "right", cellWidth: 20 },
              4: { halign: "right", cellWidth: 20 },
              5: { halign: "center", cellWidth: 20 },
            },
          });

          currentY = doc.lastAutoTable.finalY + 8;

          // SUMMARY BOX
          if (currentY > pageHeight - 60) {
            doc.addPage();
            currentY = 20;
          }

          const nilaiA = (parseFloat(catData.partA.percentage) * 0.8).toFixed(2);
          const nilaiB = (parseFloat(catData.partB.percentage) * 0.2).toFixed(2);
          const totalNilai = (parseFloat(nilaiA) + parseFloat(nilaiB)).toFixed(2);
          const statusFinal = parseFloat(totalNilai) >= 80 ? "TUNTAS" : "BELUM TUNTAS";

          doc.setFillColor(51, 65, 85);
          doc.rect(14, currentY, pageWidth - 28, 7, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.text("REKAPITULASI NILAI AKHIR SPM", 16, currentY + 5);
          doc.setTextColor(0, 0, 0);
          currentY += 10;

          autoTable(doc, {
            startY: currentY,
            head: [["Komponen", "Bobot", "Capaian (%)", "Nilai Tertimbang"]],
            body: [
              ["A. Layanan Dasar", "80%", `${catData.partA.percentage}%`, nilaiA],
              ["B. Mutu Minimal", "20%", `${catData.partB.percentage}%`, nilaiB],
            ],
            foot: [
              ["TOTAL NILAI AKHIR SPM", "100%", "", totalNilai],
              ["STATUS CAPAIAN", "", "", statusFinal],
            ],
            theme: "grid",
            headStyles: { fillColor: [30, 41, 59], fontSize: 9, halign: "center" },
            bodyStyles: { fontSize: 9 },
            footStyles: { 
              fillColor: statusFinal === "TUNTAS" ? [5, 150, 105] : [220, 38, 38], 
              textColor: [255, 255, 255], 
              fontSize: 10, 
              fontStyle: "bold" 
            },
            columnStyles: {
              0: { cellWidth: 50 },
              1: { halign: "center", cellWidth: 25 },
              2: { halign: "center", cellWidth: 30 },
              3: { halign: "center", cellWidth: 35 },
            },
          });
        }
      }

      // ============================================
      // FOOTER - TTD dan Tanggal
      // ============================================
      const footerY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 15 : currentY + 15;
      
      if (footerY < pageHeight - 45) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(
          `Dicetak pada: ${new Date().toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" })}`,
          14,
          footerY,
        );

        const ttdX = pageWidth - 75;
        doc.text(
          "Kolonodale, " +
            new Date().toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }),
          ttdX,
          footerY,
        );
        doc.setFont("helvetica", "bold");
        doc.text("Kepala Dinas Kesehatan", ttdX, footerY + 6);
        doc.text("Kabupaten Morowali Utara", ttdX, footerY + 11);
        doc.setFont("helvetica", "normal");
        doc.text("_________________________", ttdX, footerY + 30);
        doc.text("NIP.", ttdX, footerY + 35);
      }

      // Filename
      const filename = isRecapView
        ? `SPM_REKAP_${selectedProgramType}_Kabupaten_${selectedPeriod}.pdf`
        : `SPM_DETAIL_${selectedProgramType}_${selectedPuskesmas}_${selectedPeriod}.pdf`;

      doc.save(filename);
    } catch (err) {
      console.error("Export PDF error:", err);
      setError("Gagal mengekspor ke PDF: " + err.message);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Laporan & Ekspor Data
            </h1>
            <p className="text-slate-600">
              Generate laporan dalam format Excel atau PDF
            </p>
          </div>
        </div>

        {/* Program Type TAB Selector */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
              Pilih Jenis Layanan SPM
            </h2>
          </div>
          <div className="flex">
            {PROGRAM_TYPES_LIST.map((program) => {
              const isActive = selectedProgramType === program.value;
              const theme = program.theme;
              return (
                <button
                  key={program.value}
                  onClick={() => setSelectedProgramType(program.value)}
                  className={`flex-1 px-6 py-4 text-center transition-all border-b-4 ${
                    isActive
                      ? `${theme.bgLight} ${theme.textDark} ${theme.borderDark} font-bold`
                      : "bg-white text-slate-600 border-transparent hover:bg-slate-50"
                  }`}
                >
                  <span className="text-xl mr-2">{program.icon}</span>
                  <span className="text-sm md:text-base">{program.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">{programConfig.icon}</span>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                Filter Laporan - {programConfig.label}
              </h2>
              <p className="text-sm text-slate-500">{programConfig.description}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Period - Dropdown Triwulan */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Periode <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {periodOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Puskesmas */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Puskesmas
              </label>
              <select
                value={selectedPuskesmas}
                onChange={(e) => setSelectedPuskesmas(e.target.value)}
                disabled={!isAdmin}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100"
              >
                {isAdmin && (
                  <option value="all">📊 SEMUA PUSKESMAS (Rekap)</option>
                )}
                {puskesmasList.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>
              {!isAdmin && (
                <p className="text-xs text-slate-500 mt-1">
                  * Hanya dapat melihat data Puskesmas sendiri
                </p>
              )}
            </div>

            {/* View Type Indicator */}
            <div className="flex items-end">
              <div
                className={`px-4 py-2 rounded-lg border ${isRecapView ? "bg-purple-50 border-purple-200" : "bg-blue-50 border-blue-200"}`}
              >
                <p className="text-xs text-slate-500">Jenis Tampilan</p>
                <p
                  className={`font-semibold ${isRecapView ? "text-purple-700" : "text-blue-700"}`}
                >
                  {isRecapView
                    ? "📊 Rekapitulasi Kabupaten"
                    : "📋 Detail Per Puskesmas"}
                </p>
              </div>
            </div>
          </div>

          {/* Annual Period Info */}
          {isAnnualPeriod(selectedPeriod) && (
            <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-center gap-2">
              <svg
                className="w-5 h-5 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm text-purple-700">
                <strong>Mode Rekap Tahunan:</strong> Data digabungkan dari
                seluruh Triwulan dalam tahun yang dipilih
              </p>
            </div>
          )}
        </div>

        {/* Export Buttons */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            Ekspor Laporan
          </h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={handleExportExcel}
              disabled={exporting || !selectedPeriod || data.length === 0}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-semibold rounded-lg transition-colors"
            >
              {exporting ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              )}
              Export ke Excel (.xlsx)
            </button>
            <button
              onClick={handleExportPDF}
              disabled={exporting || !selectedPeriod || data.length === 0}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-400 text-white font-semibold rounded-lg transition-colors"
            >
              {exporting ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              )}
              Export ke PDF
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-600">{error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-2 text-sm text-red-500 hover:text-red-700"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Loading Data Indicator */}
        {loadingData && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
            <svg
              className="animate-spin h-5 w-5 text-blue-600"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <p className="text-blue-600">Memuat data...</p>
          </div>
        )}

        {/* RECAP TABLE (All Puskesmas) */}
        {selectedPeriod && isRecapView && !loadingData && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-purple-50">
              <h2 className="text-lg font-semibold text-purple-800">
                📊 Rekapitulasi Seluruh Puskesmas - {getPeriodLabel()}
              </h2>
              <p className="text-sm text-purple-600">
                {recapReportData.length} Puskesmas
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-blue-900 text-white">
                  <tr>
                    <th className="px-4 py-3 text-center text-sm font-semibold w-12">
                      No
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Nama Puskesmas
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold w-20">
                      Kode
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold w-28">
                      Total Target
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold w-28">
                      Total Realisasi
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold w-28">
                      Rata-rata %
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold w-32">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recapReportData.length === 0 ? (
                    <tr>
                      <td
                        colSpan="7"
                        className="px-4 py-8 text-center text-slate-500"
                      >
                        Tidak ada data untuk periode ini
                      </td>
                    </tr>
                  ) : (
                    <>
                      {recapReportData.map((row, idx) => (
                        <tr
                          key={row.code}
                          className={`${idx % 2 === 0 ? "bg-white" : "bg-slate-50"} hover:bg-blue-50`}
                        >
                          <td className="px-4 py-3 text-center text-sm">
                            {row.no}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-slate-800">
                            {row.name}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-slate-600">
                            {row.code}
                          </td>
                          <td className="px-4 py-3 text-right text-sm tabular-nums">
                            {row.totalTarget.toLocaleString("id-ID")}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-blue-600 tabular-nums">
                            {row.totalRealization.toLocaleString("id-ID")}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`font-bold tabular-nums ${parseFloat(row.percentage) >= 100 ? "text-emerald-600" : "text-red-600"}`}
                            >
                              {row.percentage}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${row.status === "TUNTAS" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}
                            >
                              {row.status === "TUNTAS" ? "✓ TUNTAS" : "✗ BELUM"}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {/* Grand Total Row */}
                      {grandTotal && (
                        <tr className="bg-slate-800 text-white font-semibold">
                          <td className="px-4 py-3 text-center" colSpan="3">
                            TOTAL KABUPATEN
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {grandTotal.target.toLocaleString("id-ID")}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {grandTotal.realization.toLocaleString("id-ID")}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`font-bold tabular-nums ${parseFloat(grandTotal.percentage) >= 100 ? "text-emerald-400" : "text-amber-400"}`}
                            >
                              {grandTotal.percentage}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${grandTotal.status === "TUNTAS" ? "bg-emerald-500" : "bg-red-500"}`}
                            >
                              {grandTotal.status}
                            </span>
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DETAIL TABLE (Single Puskesmas) with Satuan column */}
        {selectedPeriod && !isRecapView && !loadingData && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-blue-50">
              <h2 className="text-lg font-semibold text-blue-800">
                📋 Detail Capaian - {getSelectedPuskesmasName()}
              </h2>
              <p className="text-sm text-blue-600">
                Periode: {getPeriodLabel()}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-blue-900 text-white">
                  <tr>
                    <th className="px-4 py-3 text-center text-sm font-semibold w-12">
                      No
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Indikator SPM
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold w-20">
                      Satuan
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold w-24">
                      Target
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold w-24">
                      Realisasi
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold w-24">
                      % Capaian
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold w-28">
                      Belum Terlayani
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold w-32">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detailReportData.length === 0 ? (
                    <tr>
                      <td
                        colSpan="8"
                        className="px-4 py-8 text-center text-slate-500"
                      >
                        Tidak ada data untuk periode ini
                      </td>
                    </tr>
                  ) : (
                    detailReportData.map((row, idx) => (
                      <tr
                        key={row.indicator}
                        className={`${idx % 2 === 0 ? "bg-white" : "bg-slate-50"} hover:bg-blue-50`}
                      >
                        <td className="px-4 py-3 text-center text-sm">
                          {row.no}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-800">
                          {row.indicator}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-slate-500 font-medium">
                          {row.unit}
                        </td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums">
                          {row.target.toLocaleString("id-ID")}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-blue-600 tabular-nums">
                          {row.realization.toLocaleString("id-ID")}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`font-bold tabular-nums ${parseFloat(row.percentage) >= 100 ? "text-emerald-600" : "text-red-600"}`}
                          >
                            {row.percentage}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`font-medium tabular-nums ${row.unserved > 0 ? "text-red-600" : "text-emerald-600"}`}
                          >
                            {row.unserved.toLocaleString("id-ID")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${row.status === "TUNTAS" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}
                          >
                            {row.status === "TUNTAS" ? "✓ TUNTAS" : "✗ BELUM"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
