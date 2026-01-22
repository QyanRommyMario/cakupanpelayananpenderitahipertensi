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
          .neq("puskesmas_code", "KAB")
          .eq("program_type", selectedProgramType); // FILTER BY PROGRAM TYPE

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
        };
      }
      pkmTotals[row.puskesmas_code].totalTarget += row.target_qty || 0;
      pkmTotals[row.puskesmas_code].totalRealization +=
        row.realization_qty || 0;
    });

    // Calculate metrics and sort
    return Object.values(pkmTotals)
      .map((pkm) => {
        const metrics = calculateMetrics(pkm.totalTarget, pkm.totalRealization);
        return {
          code: pkm.code,
          name: pkm.name,
          totalTarget: pkm.totalTarget,
          totalRealization: pkm.totalRealization,
          percentage: metrics.percentage,
          status: metrics.isTuntas ? "TUNTAS" : "BELUM TUNTAS",
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

  // Export to Excel
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const XLSX = (await import("xlsx")).default;

      const headerRows = [
        ["LAPORAN CAPAIAN STANDAR PELAYANAN MINIMAL (SPM)"],
        [`PROGRAM: ${programConfig.label.toUpperCase()}`],
        ["DINAS KESEHATAN KABUPATEN MOROWALI UTARA"],
        [""],
        [`PERIODE: ${getPeriodLabel()}`],
        [
          isRecapView
            ? "REKAPITULASI SELURUH PUSKESMAS"
            : `Puskesmas: ${getSelectedPuskesmasName()}`,
        ],
        [""],
      ];

      let dataRows = [];
      let tableHeader = [];

      if (isRecapView) {
        tableHeader = [
          "No",
          "Nama Puskesmas",
          "Kode",
          "Total Target",
          "Total Realisasi",
          "Rata-rata Capaian (%)",
          "Status",
        ];
        dataRows = recapReportData.map((row) => [
          row.no,
          row.name,
          row.code,
          row.totalTarget,
          row.totalRealization,
          `${row.percentage}%`,
          row.status,
        ]);
        // Add grand total
        dataRows.push([]);
        dataRows.push([
          "",
          "TOTAL KABUPATEN",
          "",
          grandTotal.target,
          grandTotal.realization,
          `${grandTotal.percentage}%`,
          grandTotal.status,
        ]);
      } else {
        tableHeader = [
          "No",
          "Indikator",
          "Satuan",
          "Target",
          "Realisasi",
          "% Capaian",
          "Belum Terlayani",
          "Status",
        ];
        dataRows = detailReportData.map((row) => [
          row.no,
          row.indicator,
          row.unit,
          row.target,
          row.realization,
          `${row.percentage}%`,
          row.unserved,
          row.status,
        ]);
      }

      const footerRows = [
        [""],
        [
          `Dicetak pada: ${new Date().toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" })}`,
        ],
      ];

      const allRows = [...headerRows, tableHeader, ...dataRows, ...footerRows];
      const ws = XLSX.utils.aoa_to_sheet(allRows);

      ws["!cols"] = isRecapView
        ? [
            { wch: 5 },
            { wch: 30 },
            { wch: 10 },
            { wch: 15 },
            { wch: 15 },
            { wch: 20 },
            { wch: 15 },
          ]
        : [
            { wch: 5 },
            { wch: 55 },
            { wch: 12 },
            { wch: 12 },
            { wch: 12 },
            { wch: 12 },
            { wch: 15 },
            { wch: 15 },
          ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        wb,
        ws,
        isRecapView ? "Rekap Kabupaten" : "Laporan Detail",
      );

      // Filename dengan program type
      const filename = isRecapView
        ? `Rekap_SPM_${selectedProgramType}_Kabupaten_${selectedPeriod}.xlsx`
        : `Laporan_SPM_${selectedProgramType}_${selectedPuskesmas}_${selectedPeriod}.xlsx`;

      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error("Export Excel error:", err);
      setError("Gagal mengekspor ke Excel: " + err.message);
    } finally {
      setExporting(false);
    }
  };

  // Export to PDF
  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF(isRecapView ? "landscape" : "portrait", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header - KOP Surat Resmi
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("PEMERINTAH KABUPATEN MOROWALI UTARA", pageWidth / 2, 12, {
        align: "center",
      });

      doc.setFontSize(14);
      doc.text("DINAS KESEHATAN", pageWidth / 2, 19, { align: "center" });

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(
        "Jl. Trans Sulawesi, Kolonodale - Kode Pos 94671",
        pageWidth / 2,
        25,
        { align: "center" },
      );

      // Horizontal line
      doc.setLineWidth(0.8);
      doc.line(14, 29, pageWidth - 14, 29);
      doc.setLineWidth(0.3);
      doc.line(14, 30, pageWidth - 14, 30);

      // Title with Period and Program
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      if (isRecapView) {
        doc.text(
          `REKAPITULASI CAPAIAN ${programConfig.label.toUpperCase()} SELURUH PUSKESMAS`,
          pageWidth / 2,
          38,
          { align: "center" },
        );
      } else {
        doc.text(
          `LAPORAN CAPAIAN ${programConfig.label.toUpperCase()} PUSKESMAS ${getSelectedPuskesmasName().toUpperCase()}`,
          pageWidth / 2,
          38,
          { align: "center" },
        );
      }
      doc.text("BIDANG KESEHATAN", pageWidth / 2, 44, { align: "center" });

      // Period info
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`PERIODE: ${getPeriodLabel()}`, 14, 52);

      // Table
      if (isRecapView) {
        // Recap table
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
          startY: 56,
          head: [
            [
              "No",
              "Nama Puskesmas",
              "Kode",
              "Total Target",
              "Total Realisasi",
              "% Capaian",
              "Status",
            ],
          ],
          body: tableData,
          foot: [
            [
              "",
              "TOTAL KABUPATEN",
              "",
              grandTotal.target.toLocaleString("id-ID"),
              grandTotal.realization.toLocaleString("id-ID"),
              `${grandTotal.percentage}%`,
              grandTotal.status,
            ],
          ],
          theme: "grid",
          headStyles: {
            fillColor: [30, 58, 138],
            fontSize: 9,
            halign: "center",
          },
          bodyStyles: { fontSize: 9 },
          footStyles: {
            fillColor: [51, 65, 85],
            textColor: [255, 255, 255],
            fontSize: 9,
            fontStyle: "bold",
          },
          columnStyles: {
            0: { halign: "center", cellWidth: 10 },
            1: { cellWidth: 60 },
            2: { halign: "center", cellWidth: 20 },
            3: { halign: "right", cellWidth: 30 },
            4: { halign: "right", cellWidth: 35 },
            5: { halign: "center", cellWidth: 25 },
            6: { halign: "center", cellWidth: 30 },
          },
          didParseCell: function (data) {
            if (data.column.index === 6 && data.section === "body") {
              data.cell.styles.textColor =
                data.cell.raw === "TUNTAS" ? [5, 150, 105] : [220, 38, 38];
              data.cell.styles.fontStyle = "bold";
            }
          },
        });
      } else {
        // Detail table with Satuan column
        const tableData = detailReportData.map((row) => [
          row.no,
          row.indicator,
          row.unit,
          row.target.toLocaleString("id-ID"),
          row.realization.toLocaleString("id-ID"),
          `${row.percentage}%`,
          row.unserved.toLocaleString("id-ID"),
          row.status,
        ]);

        autoTable(doc, {
          startY: 56,
          head: [
            [
              "No",
              "Indikator SPM",
              "Satuan",
              "Target",
              "Realisasi",
              "% Capaian",
              "Belum Terlayani",
              "Status",
            ],
          ],
          body: tableData,
          theme: "grid",
          headStyles: {
            fillColor: [30, 58, 138],
            fontSize: 8,
            halign: "center",
          },
          bodyStyles: { fontSize: 8 },
          columnStyles: {
            0: { halign: "center", cellWidth: 8 },
            1: { cellWidth: 55 },
            2: { halign: "center", cellWidth: 18 },
            3: { halign: "right", cellWidth: 18 },
            4: { halign: "right", cellWidth: 18 },
            5: { halign: "center", cellWidth: 18 },
            6: { halign: "right", cellWidth: 22 },
            7: { halign: "center", cellWidth: 22 },
          },
          didParseCell: function (data) {
            if (data.column.index === 7 && data.section === "body") {
              data.cell.styles.textColor =
                data.cell.raw === "TUNTAS" ? [5, 150, 105] : [220, 38, 38];
              data.cell.styles.fontStyle = "bold";
            }
          },
        });
      }

      // Footer & Signature
      const footerY = doc.lastAutoTable.finalY + 15;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Dicetak pada: ${new Date().toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" })}`,
        14,
        footerY,
      );

      doc.text(
        "Kolonodale, " +
          new Date().toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
        pageWidth - 80,
        footerY,
      );
      doc.text("Kepala Dinas Kesehatan", pageWidth - 80, footerY + 25);
      doc.text("Kabupaten Morowali Utara", pageWidth - 80, footerY + 30);
      doc.text("_________________________", pageWidth - 80, footerY + 45);
      doc.text("NIP.", pageWidth - 80, footerY + 50);

      // Filename dengan program type
      const filename = isRecapView
        ? `Rekap_SPM_${selectedProgramType}_Kabupaten_${selectedPeriod}.pdf`
        : `Laporan_SPM_${selectedProgramType}_${selectedPuskesmas}_${selectedPeriod}.pdf`;

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
