"use client";
import { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";
import { getGlobalSummary } from "@/lib/dataHelpers";
import {
  generateTriwulanOptions,
  getCurrentPeriod,
  parsePeriod,
  isAnnualPeriod,
  getQuartersForYear,
  formatPeriodLabel,
} from "@/utils/periods";
import { PROGRAMS } from "@/utils/constants";

/**
 * COMMAND CENTER - Overview Dashboard
 * Menampilkan SELURUH data Puskesmas secara transparan
 * "Siapa yang kerja bagus, siapa yang nol besar"
 */
export default function CommandCenterPage() {
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [globalData, setGlobalData] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "avg", direction: "asc" });

  const periodOptions = useMemo(() => generateTriwulanOptions(), []);

  // Initialize
  useEffect(() => {
    setSelectedPeriod(getCurrentPeriod());
    setLoading(false);
  }, []);

  // Fetch global data when period changes
  useEffect(() => {
    async function fetchData() {
      if (!selectedPeriod) return;

      try {
        setLoadingData(true);

        let periods = null;
        let period = selectedPeriod;

        if (isAnnualPeriod(selectedPeriod)) {
          const parsed = parsePeriod(selectedPeriod);
          periods = getQuartersForYear(parsed.year);
          period = null;
        }

        const data = await getGlobalSummary(period, periods);
        setGlobalData(data);
      } catch (err) {
        console.error("Error fetching global data:", err);
      } finally {
        setLoadingData(false);
      }
    }

    fetchData();
  }, [selectedPeriod]);

  // Color scale function
  const getScoreColor = (score) => {
    if (score >= 100) return { bg: "bg-emerald-100", text: "text-emerald-800", hex: "#10b981" };
    if (score >= 80) return { bg: "bg-emerald-50", text: "text-emerald-700", hex: "#34d399" };
    if (score >= 50) return { bg: "bg-amber-100", text: "text-amber-800", hex: "#f59e0b" };
    if (score > 0) return { bg: "bg-red-100", text: "text-red-800", hex: "#ef4444" };
    return { bg: "bg-gray-100", text: "text-gray-500", hex: "#9ca3af" };
  };

  // Sorting function
  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    if (!globalData?.puskesmasScores) return [];

    let filtered = globalData.puskesmasScores;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.code.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    return [...filtered].sort((a, b) => {
      const aVal = a[sortConfig.key] ?? 0;
      const bVal = b[sortConfig.key] ?? 0;
      if (sortConfig.key === "name") {
        return sortConfig.direction === "asc" 
          ? a.name.localeCompare(b.name, "id") 
          : b.name.localeCompare(a.name, "id");
      }
      return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [globalData, searchQuery, sortConfig]);

  // Bar chart data - ALL Puskesmas
  const barChartData = useMemo(() => {
    if (!globalData?.puskesmasScores) return [];
    return [...globalData.puskesmasScores]
      .sort((a, b) => b.avg - a.avg) // Best first for chart
      .map((p) => ({
        name: p.name,
        code: p.code,
        Hipertensi: p.hipertensi,
        Diabetes: p.diabetes,
        ODGJ: p.odgj,
        "Rata-rata": p.avg,
      }));
  }, [globalData]);

  // Sort indicator icon
  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return <span className="text-gray-400 ml-1">↕</span>;
    }
    return (
      <span className="text-yellow-400 ml-1">
        {sortConfig.direction === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  // Custom tooltip for bar chart
  const CustomBarTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 rounded-xl shadow-xl border border-gray-200">
          <p className="font-bold text-gray-800 mb-2">{label}</p>
          <div className="space-y-1 text-sm">
            <p className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-rose-500"></span>
              Hipertensi: <span className="font-semibold">{data.Hipertensi}%</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-emerald-500"></span>
              Diabetes: <span className="font-semibold">{data.Diabetes}%</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-violet-500"></span>
              ODGJ: <span className="font-semibold">{data.ODGJ}%</span>
            </p>
            <div className="pt-2 border-t mt-2">
              <p className="font-bold text-blue-600">
                Rata-rata: {data["Rata-rata"]}%
              </p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Period label
  const periodLabel = useMemo(() => formatPeriodLabel(selectedPeriod), [selectedPeriod]);

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
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-full mx-auto space-y-6">
          {/* ============================================ */}
          {/* HEADER */}
          {/* ============================================ */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                🏥 Command Center SPM Kesehatan
              </h1>
              <p className="text-gray-500 mt-1">
                Rapor Kinerja Seluruh Puskesmas • Periode:{" "}
                <span className="font-semibold text-blue-600">{periodLabel}</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600 font-medium">Periode:</label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-blue-500 min-w-[220px]"
              >
                {periodOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {loadingData && (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              )}
            </div>
          </div>

          {/* ============================================ */}
          {/* KPI CARDS - 3 Program Summary */}
          {/* ============================================ */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Hipertensi */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wide flex items-center gap-2">
                    <span className="text-xl">❤️</span> Hipertensi
                  </p>
                  <p className="text-3xl font-bold text-rose-600 mt-2">
                    {globalData?.programTotals?.hipertensi?.percentage || 0}%
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {(globalData?.programTotals?.hipertensi?.realization || 0).toLocaleString("id-ID")} /{" "}
                    {(globalData?.programTotals?.hipertensi?.target || 0).toLocaleString("id-ID")} sasaran
                  </p>
                </div>
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${PROGRAMS.HIPERTENSI.theme.bgLight}`}>
                  <span className="text-2xl">❤️</span>
                </div>
              </div>
            </div>

            {/* Diabetes */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wide flex items-center gap-2">
                    <span className="text-xl">🩸</span> Diabetes
                  </p>
                  <p className="text-3xl font-bold text-emerald-600 mt-2">
                    {globalData?.programTotals?.diabetes?.percentage || 0}%
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {(globalData?.programTotals?.diabetes?.realization || 0).toLocaleString("id-ID")} /{" "}
                    {(globalData?.programTotals?.diabetes?.target || 0).toLocaleString("id-ID")} sasaran
                  </p>
                </div>
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${PROGRAMS.DIABETES.theme.bgLight}`}>
                  <span className="text-2xl">🩸</span>
                </div>
              </div>
            </div>

            {/* ODGJ */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wide flex items-center gap-2">
                    <span className="text-xl">🧠</span> ODGJ
                  </p>
                  <p className="text-3xl font-bold text-violet-600 mt-2">
                    {globalData?.programTotals?.odgj?.percentage || 0}%
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {(globalData?.programTotals?.odgj?.realization || 0).toLocaleString("id-ID")} /{" "}
                    {(globalData?.programTotals?.odgj?.target || 0).toLocaleString("id-ID")} sasaran
                  </p>
                </div>
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${PROGRAMS.ODGJ.theme.bgLight}`}>
                  <span className="text-2xl">🧠</span>
                </div>
              </div>
            </div>
          </div>

          {/* Grand Total Banner */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-6 text-white">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">📊 Total Capaian Kabupaten</h2>
                <p className="text-blue-100 text-sm mt-1">
                  Agregat dari seluruh program SPM
                </p>
              </div>
              <div className="text-right">
                <p className="text-5xl font-bold">{globalData?.grandTotal?.percentage || 0}%</p>
                <p className="text-blue-200 text-sm mt-1">
                  {(globalData?.grandTotal?.realization || 0).toLocaleString("id-ID")} dari{" "}
                  {(globalData?.grandTotal?.target || 0).toLocaleString("id-ID")} total sasaran
                </p>
              </div>
            </div>
          </div>

          {/* ============================================ */}
          {/* BAR CHART - ALL PUSKESMAS (Scrollable) */}
          {/* ============================================ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-800">
                📊 Grafik Capaian Seluruh Puskesmas
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Perbandingan capaian 3 program SPM per Puskesmas (scroll untuk melihat semua)
              </p>
            </div>
            <div className="p-4 overflow-x-auto">
              {/* Dynamic height based on data count */}
              <div style={{ height: Math.max(400, barChartData.length * 50), minWidth: 600 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={barChartData}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 120, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#6b7280" }} tickFormatter={(v) => `${v}%`} />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      tick={{ fontSize: 11, fill: "#374151" }} 
                      width={110}
                    />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Legend />
                    <Bar dataKey="Hipertensi" fill="#e11d48" radius={[0, 2, 2, 0]} maxBarSize={15} />
                    <Bar dataKey="Diabetes" fill="#059669" radius={[0, 2, 2, 0]} maxBarSize={15} />
                    <Bar dataKey="ODGJ" fill="#7c3aed" radius={[0, 2, 2, 0]} maxBarSize={15} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ============================================ */}
          {/* LEADERBOARD TABLE - Rapor Kinerja Puskesmas */}
          {/* ============================================ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 bg-slate-800 text-white">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    🏆 Rapor Kinerja Puskesmas
                  </h2>
                  <p className="text-slate-300 text-sm mt-1">
                    Klik header kolom untuk mengurutkan • Total {filteredAndSortedData.length} Puskesmas
                  </p>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Cari Puskesmas..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 w-64"
                  />
                  <svg
                    className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Color Legend */}
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center gap-4 text-sm">
              <span className="font-medium text-gray-700">Legenda Warna:</span>
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 rounded bg-emerald-100 border border-emerald-300"></span>
                ≥100% (Tuntas)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 rounded bg-emerald-50 border border-emerald-200"></span>
                80-99%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 rounded bg-amber-100 border border-amber-300"></span>
                50-79%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 rounded bg-red-100 border border-red-300"></span>
                &lt;50%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 rounded bg-gray-100 border border-gray-300"></span>
                Tidak ada data
              </span>
            </div>

            {/* Scrollable Table with Sticky Header */}
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-700 text-white">
                    <th className="px-4 py-3 text-center text-sm font-semibold w-14">
                      #
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-slate-600 transition-colors"
                      onClick={() => handleSort("name")}
                    >
                      Nama Puskesmas <SortIcon columnKey="name" />
                    </th>
                    <th 
                      className="px-4 py-3 text-center text-sm font-semibold cursor-pointer hover:bg-slate-600 transition-colors min-w-[120px]"
                      onClick={() => handleSort("hipertensi")}
                    >
                      ❤️ Hipertensi <SortIcon columnKey="hipertensi" />
                    </th>
                    <th 
                      className="px-4 py-3 text-center text-sm font-semibold cursor-pointer hover:bg-slate-600 transition-colors min-w-[120px]"
                      onClick={() => handleSort("diabetes")}
                    >
                      🩸 Diabetes <SortIcon columnKey="diabetes" />
                    </th>
                    <th 
                      className="px-4 py-3 text-center text-sm font-semibold cursor-pointer hover:bg-slate-600 transition-colors min-w-[120px]"
                      onClick={() => handleSort("odgj")}
                    >
                      🧠 ODGJ <SortIcon columnKey="odgj" />
                    </th>
                    <th 
                      className="px-4 py-3 text-center text-sm font-semibold cursor-pointer hover:bg-slate-600 transition-colors min-w-[130px]"
                      onClick={() => handleSort("avg")}
                    >
                      📊 Rata-rata <SortIcon columnKey="avg" />
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold min-w-[100px]">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                        {searchQuery ? (
                          <>
                            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            Tidak ada Puskesmas dengan nama &ldquo;{searchQuery}&rdquo;
                          </>
                        ) : (
                          <>
                            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                            </svg>
                            Belum ada data untuk periode ini
                          </>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredAndSortedData.map((pkm, idx) => {
                      const hColor = getScoreColor(pkm.hipertensi);
                      const dColor = getScoreColor(pkm.diabetes);
                      const oColor = getScoreColor(pkm.odgj);
                      const avgColor = getScoreColor(pkm.avg);
                      const isLowPerformer = pkm.avg < 50;

                      return (
                        <tr
                          key={pkm.code}
                          className={`
                            border-b border-gray-100 transition-colors
                            ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                            ${isLowPerformer ? "!bg-red-50/50" : ""}
                            hover:bg-blue-50
                          `}
                        >
                          <td className="px-4 py-3 text-center text-sm text-gray-500 font-medium">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-gray-800">{pkm.name}</p>
                            <p className="text-xs text-gray-500">{pkm.code}</p>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-3 py-1 rounded-lg font-bold text-sm ${hColor.bg} ${hColor.text}`}>
                              {pkm.hipertensi}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-3 py-1 rounded-lg font-bold text-sm ${dColor.bg} ${dColor.text}`}>
                              {pkm.diabetes}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-3 py-1 rounded-lg font-bold text-sm ${oColor.bg} ${oColor.text}`}>
                              {pkm.odgj}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-4 py-1 rounded-lg font-bold ${avgColor.bg} ${avgColor.text}`}>
                              {pkm.avg}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {pkm.avg >= 100 ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                                ✓ TUNTAS
                              </span>
                            ) : pkm.avg >= 80 ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                                ◐ HAMPIR
                              </span>
                            ) : pkm.avg > 0 ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">
                                ✗ BELUM
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
                                — N/A
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer Summary */}
            {filteredAndSortedData.length > 0 && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
                  <div className="flex items-center gap-6">
                    <span className="text-gray-600">
                      <strong className="text-emerald-600">
                        {filteredAndSortedData.filter((p) => p.avg >= 100).length}
                      </strong>{" "}
                      Tuntas
                    </span>
                    <span className="text-gray-600">
                      <strong className="text-blue-600">
                        {filteredAndSortedData.filter((p) => p.avg >= 80 && p.avg < 100).length}
                      </strong>{" "}
                      Hampir
                    </span>
                    <span className="text-gray-600">
                      <strong className="text-red-600">
                        {filteredAndSortedData.filter((p) => p.avg > 0 && p.avg < 80).length}
                      </strong>{" "}
                      Belum
                    </span>
                    <span className="text-gray-600">
                      <strong className="text-gray-500">
                        {filteredAndSortedData.filter((p) => p.avg === 0).length}
                      </strong>{" "}
                      Tidak ada data
                    </span>
                  </div>
                  <p className="text-gray-500">
                    Total: <strong>{filteredAndSortedData.length}</strong> Puskesmas
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions - Link to Detail Pages */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="/hipertensi"
              className="flex items-center gap-4 p-4 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 transition-colors"
            >
              <div className="w-12 h-12 bg-rose-600 rounded-xl flex items-center justify-center">
                <span className="text-2xl">❤️</span>
              </div>
              <div>
                <p className="font-semibold text-rose-800">Detail Hipertensi</p>
                <p className="text-sm text-rose-600">Lihat rincian per indikator</p>
              </div>
            </a>
            <a
              href="/diabetes"
              className="flex items-center gap-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors"
            >
              <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center">
                <span className="text-2xl">🩸</span>
              </div>
              <div>
                <p className="font-semibold text-emerald-800">Detail Diabetes</p>
                <p className="text-sm text-emerald-600">Lihat rincian per indikator</p>
              </div>
            </a>
            <a
              href="/odgj"
              className="flex items-center gap-4 p-4 bg-violet-50 border border-violet-200 rounded-xl hover:bg-violet-100 transition-colors"
            >
              <div className="w-12 h-12 bg-violet-600 rounded-xl flex items-center justify-center">
                <span className="text-2xl">🧠</span>
              </div>
              <div>
                <p className="font-semibold text-violet-800">Detail ODGJ</p>
                <p className="text-sm text-violet-600">Lihat rincian per indikator</p>
              </div>
            </a>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-gray-400 py-4">
            Data diperbarui secara realtime dari Supabase • Dinas Kesehatan Kab. Morowali Utara
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}