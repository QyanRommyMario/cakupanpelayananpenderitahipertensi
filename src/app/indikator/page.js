"use client";
import { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";
import logger from "@/lib/logger";
import {
  generateTriwulanOptions,
  getCurrentPeriod,
  parsePeriod,
  isAnnualPeriod,
  getQuartersForYear,
  formatPeriodLabel,
} from "@/utils/periods";
import {
  PROGRAMS,
  PROGRAM_TYPES,
  PROGRAM_TYPES_LIST,
  getAllIndicators,
  isPartAIndicator,
} from "@/utils/constants";

/**
 * HALAMAN ANALISA PER INDIKATOR - "Mikroskop Data"
 * Melihat ketersediaan satu indikator di SELURUH Puskesmas
 */
export default function IndikatorPage() {
  // State
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [rawData, setRawData] = useState([]);
  const [puskesmasMaster, setPuskesmasMaster] = useState([]);

  // KEAMANAN: User & Role State
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userPuskesmasCode, setUserPuskesmasCode] = useState(null);
  const [userLoaded, setUserLoaded] = useState(false); // PENTING: Track user loading

  // Filters
  const [selectedProgram, setSelectedProgram] = useState(
    PROGRAM_TYPES.HIPERTENSI,
  );
  const [selectedIndicator, setSelectedIndicator] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: "gap",
    direction: "desc",
  });

  const periodOptions = useMemo(() => generateTriwulanOptions(), []);

  // Helper: Check if user is admin based on email
  // Check admin status from Supabase user_metadata
  // Set di Supabase Dashboard: Authentication > Users > Edit > user_metadata: {"is_admin": true}
  const checkIsAdmin = (user) => {
    return user?.user_metadata?.is_admin === true;
  };

  // Get indicator options based on selected program
  const indicatorOptions = useMemo(() => {
    return getAllIndicators(selectedProgram);
  }, [selectedProgram]);

  // Initialize
  useEffect(() => {
    async function init() {
      try {
        // KEAMANAN: Get user session
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          setCurrentUser(session.user);
          const adminStatus = checkIsAdmin(session.user);
          setIsAdmin(adminStatus);

          if (!adminStatus) {
            const emailCode = session.user.email.split("@")[0].toUpperCase();
            setUserPuskesmasCode(emailCode);
          }
        }

        const { data: pkm } = await supabase
          .from("puskesmas")
          .select("*")
          .order("name");
        setPuskesmasMaster(pkm || []);
        setSelectedPeriod(getCurrentPeriod());
      } finally {
        setUserLoaded(true); // PENTING: Set setelah user info ter-load
        setLoading(false);
      }
    }
    init();
  }, []);

  // Set default indicator when program changes
  useEffect(() => {
    if (
      indicatorOptions.length > 0 &&
      !indicatorOptions.includes(selectedIndicator)
    ) {
      setSelectedIndicator(indicatorOptions[0]);
    }
  }, [selectedProgram, indicatorOptions, selectedIndicator]);

  // Fetch data when filters change
  // KEAMANAN: Filter berdasarkan role user
  useEffect(() => {
    async function fetchData() {
      // PENTING: Tunggu sampai user info ter-load
      if (!selectedPeriod || !selectedIndicator || !userLoaded) return;

      try {
        setLoadingData(true);

        let query = supabase
          .from("achievements")
          .select("*")
          .eq("program_type", selectedProgram)
          .eq("indicator_name", selectedIndicator)
          .neq("puskesmas_code", "KAB");

        // KEAMANAN: Non-admin hanya bisa melihat data puskesmas sendiri
        if (!isAdmin && userPuskesmasCode) {
          query = query.eq("puskesmas_code", userPuskesmasCode);
        }

        if (isAnnualPeriod(selectedPeriod)) {
          const parsed = parsePeriod(selectedPeriod);
          const quarters = getQuartersForYear(parsed.year);
          query = query.in("period", quarters);
        } else {
          query = query.eq("period", selectedPeriod);
        }

        const { data, error } = await query;
        if (error) throw error;
        setRawData(data || []);
      } catch (err) {
        logger.error("Error fetching indicator data", err, { selectedProgram, selectedIndicator });
      } finally {
        setLoadingData(false);
      }
    }

    fetchData();
  }, [
    selectedProgram,
    selectedIndicator,
    selectedPeriod,
    isAdmin,
    userPuskesmasCode,
    userLoaded,
  ]);

  // Process data per Puskesmas
  const processedData = useMemo(() => {
    const pkmMap = {};

    rawData.forEach((row) => {
      if (!pkmMap[row.puskesmas_code]) {
        pkmMap[row.puskesmas_code] = {
          code: row.puskesmas_code,
          target: 0,
          realization: 0,
        };
      }
      pkmMap[row.puskesmas_code].target += parseFloat(row.target_qty) || 0;
      pkmMap[row.puskesmas_code].realization +=
        parseFloat(row.realization_qty) || 0;
    });

    return Object.values(pkmMap).map((p) => {
      const pkm = puskesmasMaster.find((m) => m.code === p.code);
      const gap = Math.max(0, p.target - p.realization);
      const percentage = p.target > 0 ? (p.realization / p.target) * 100 : null;

      return {
        ...p,
        name: pkm?.name || p.code,
        gap,
        percentage:
          percentage !== null ? parseFloat(percentage.toFixed(1)) : null,
      };
    });
  }, [rawData, puskesmasMaster]);

  // Filter and sort
  const filteredAndSortedData = useMemo(() => {
    let filtered = processedData;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q),
      );
    }

    return [...filtered].sort((a, b) => {
      const aVal = a[sortConfig.key] ?? -1;
      const bVal = b[sortConfig.key] ?? -1;
      if (sortConfig.key === "name") {
        return sortConfig.direction === "asc"
          ? a.name.localeCompare(b.name, "id")
          : b.name.localeCompare(a.name, "id");
      }
      return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [processedData, searchQuery, sortConfig]);

  // Summary stats
  const summary = useMemo(() => {
    const totalTarget = processedData.reduce((sum, p) => sum + p.target, 0);
    const totalRealization = processedData.reduce(
      (sum, p) => sum + p.realization,
      0,
    );
    const totalGap = processedData.reduce((sum, p) => sum + p.gap, 0);
    const avgPercentage =
      totalTarget > 0
        ? ((totalRealization / totalTarget) * 100).toFixed(1)
        : "N/A";
    const pkmWithGap = processedData.filter((p) => p.gap > 0).length;
    const pkmComplete = processedData.filter(
      (p) => p.percentage !== null && p.percentage >= 100,
    ).length;

    return {
      totalTarget,
      totalRealization,
      totalGap,
      avgPercentage,
      pkmWithGap,
      pkmComplete,
      total: processedData.length,
    };
  }, [processedData]);

  // Chart data - sorted by worst first
  const chartData = useMemo(() => {
    return [...processedData]
      .filter((p) => p.target > 0)
      .sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0));
  }, [processedData]);

  // Handlers
  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  // Get current program config
  const programConfig = PROGRAMS[selectedProgram];
  const theme = programConfig.theme;
  const isPartA = isPartAIndicator(selectedProgram, selectedIndicator);

  // Color for percentage
  const getPercentageColor = (pct) => {
    if (pct === null)
      return { bg: "bg-gray-100", text: "text-gray-500", bar: "#9ca3af" };
    if (pct >= 100)
      return { bg: "bg-emerald-100", text: "text-emerald-800", bar: "#10b981" };
    if (pct >= 80)
      return { bg: "bg-emerald-50", text: "text-emerald-700", bar: "#34d399" };
    if (pct >= 50)
      return { bg: "bg-amber-100", text: "text-amber-800", bar: "#f59e0b" };
    return { bg: "bg-red-100", text: "text-red-800", bar: "#ef4444" };
  };

  // Sort icon
  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey)
      return <span className="text-gray-400 ml-1">↕</span>;
    return (
      <span className="text-yellow-400 ml-1">
        {sortConfig.direction === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-white p-4 rounded-xl shadow-xl border border-gray-200 text-sm">
          <p className="font-bold text-gray-800 mb-2">{d.name}</p>
          <div className="space-y-1">
            <p>
              Kebutuhan (Target):{" "}
              <span className="font-semibold">
                {d.target.toLocaleString("id-ID")}
              </span>
            </p>
            <p>
              Ketersediaan (Realisasi):{" "}
              <span className="font-semibold text-emerald-600">
                {d.realization.toLocaleString("id-ID")}
              </span>
            </p>
            <p>
              Kekurangan (Gap):{" "}
              <span
                className={`font-semibold ${d.gap > 0 ? "text-red-600" : "text-emerald-600"}`}
              >
                {d.gap.toLocaleString("id-ID")}
              </span>
            </p>
            <p className="pt-2 border-t mt-2">
              % Terpenuhi:{" "}
              <span
                className={`font-bold ${d.percentage >= 100 ? "text-emerald-600" : d.percentage >= 50 ? "text-amber-600" : "text-red-600"}`}
              >
                {d.percentage !== null ? `${d.percentage}%` : "N/A"}
              </span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Format percentage display
  const formatPercentage = (pct) => {
    if (pct === null) return "N/A";
    return `${pct}%`;
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
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-full mx-auto space-y-6">
          {/* ============================================ */}
          {/* HEADER & FILTERS */}
          {/* ============================================ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                  🔬 Analisa Per Indikator
                </h1>
                <p className="text-gray-500 mt-1">
                  Lihat ketersediaan satu indikator di SELURUH Puskesmas
                </p>
              </div>

              {/* Filter Controls */}
              <div className="flex flex-wrap items-end gap-4">
                {/* Program Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Program SPM
                  </label>
                  <select
                    value={selectedProgram}
                    onChange={(e) => setSelectedProgram(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-blue-500 min-w-[180px]"
                  >
                    {PROGRAM_TYPES_LIST.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.icon} {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Indicator Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Nama Indikator
                  </label>
                  <select
                    value={selectedIndicator}
                    onChange={(e) => setSelectedIndicator(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-blue-500 min-w-[300px] max-w-[400px]"
                  >
                    {indicatorOptions.map((ind) => (
                      <option key={ind} value={ind}>
                        {ind}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Period Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Periode
                  </label>
                  <select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-blue-500 min-w-[180px]"
                  >
                    {periodOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {loadingData && (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                )}
              </div>
            </div>

            {/* Selected Indicator Info */}
            <div
              className={`mt-6 p-4 rounded-xl ${theme.bgLighter} border ${theme.border}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{programConfig.icon}</span>
                <div>
                  <h2 className={`text-xl font-bold ${theme.textDark}`}>
                    {selectedIndicator || "Pilih Indikator"}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${isPartA ? "bg-blue-100 text-blue-800" : "bg-slate-200 text-slate-700"}`}
                    >
                      {isPartA
                        ? "📊 Bagian A: Sasaran Manusia"
                        : "🔧 Bagian B: Sumber Daya (Barang/Jasa/SDM)"}
                    </span>
                    <span className="ml-2">
                      • Periode:{" "}
                      <strong>{formatPeriodLabel(selectedPeriod)}</strong>
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ============================================ */}
          {/* SUMMARY CARDS */}
          {/* ============================================ */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase">
                Total Kebutuhan
              </p>
              <p className="text-2xl font-bold text-slate-700 mt-1">
                {summary.totalTarget.toLocaleString("id-ID")}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase">
                Total Tersedia
              </p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">
                {summary.totalRealization.toLocaleString("id-ID")}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase">
                Total Kekurangan
              </p>
              <p
                className={`text-2xl font-bold mt-1 ${summary.totalGap > 0 ? "text-red-600" : "text-emerald-600"}`}
              >
                {summary.totalGap.toLocaleString("id-ID")}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase">
                Rata-rata Capaian
              </p>
              <p
                className={`text-2xl font-bold mt-1 ${parseFloat(summary.avgPercentage) >= 100 ? "text-emerald-600" : "text-amber-600"}`}
              >
                {summary.avgPercentage === "N/A"
                  ? "N/A"
                  : `${summary.avgPercentage}%`}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase">
                PKM Terpenuhi
              </p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">
                {summary.pkmComplete}{" "}
                <span className="text-sm text-gray-400">/ {summary.total}</span>
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase">
                PKM Kekurangan
              </p>
              <p
                className={`text-2xl font-bold mt-1 ${summary.pkmWithGap > 0 ? "text-red-600" : "text-emerald-600"}`}
              >
                {summary.pkmWithGap}{" "}
                <span className="text-sm text-gray-400">/ {summary.total}</span>
              </p>
            </div>
          </div>

          {/* ============================================ */}
          {/* BAR CHART - Perbandingan Semua Puskesmas */}
          {/* ============================================ */}
          {chartData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-800">
                  📊 Perbandingan Ketersediaan di Seluruh Puskesmas
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Visualisasi % terpenuhi per Puskesmas untuk indikator:{" "}
                  <strong>{selectedIndicator}</strong>
                </p>
              </div>
              <div className="p-4">
                <div
                  style={{
                    height: Math.max(300, chartData.length * 40),
                    minHeight: 280,
                    minWidth: 600,
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%" minHeight={280}>
                    <BarChart
                      data={chartData}
                      layout="vertical"
                      margin={{ top: 10, right: 60, left: 120, bottom: 10 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        horizontal={true}
                        vertical={false}
                        stroke="#e5e7eb"
                      />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11, fill: "#374151" }}
                        width={110}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar
                        dataKey="percentage"
                        radius={[0, 4, 4, 0]}
                        maxBarSize={25}
                      >
                        {chartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={getPercentageColor(entry.percentage).bar}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* ============================================ */}
          {/* DETAIL TABLE */}
          {/* ============================================ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 bg-slate-800 text-white">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold">
                    📋 Tabel Detail Per Puskesmas
                  </h2>
                  <p className="text-slate-300 text-sm mt-1">
                    Klik header untuk mengurutkan • Total{" "}
                    {filteredAndSortedData.length} Puskesmas
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
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Color Legend */}
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center gap-4 text-sm">
              <span className="font-medium text-gray-700">Legenda Warna:</span>
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 rounded bg-emerald-100 border border-emerald-300"></span>
                ≥100% (Terpenuhi)
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
                N/A
              </span>
            </div>

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
                      Puskesmas <SortIcon columnKey="name" />
                    </th>
                    <th
                      className="px-4 py-3 text-center text-sm font-semibold cursor-pointer hover:bg-slate-600 transition-colors min-w-[140px]"
                      onClick={() => handleSort("target")}
                    >
                      Kebutuhan (Target) <SortIcon columnKey="target" />
                    </th>
                    <th
                      className="px-4 py-3 text-center text-sm font-semibold cursor-pointer hover:bg-slate-600 transition-colors min-w-[160px]"
                      onClick={() => handleSort("realization")}
                    >
                      Ketersediaan (Realisasi){" "}
                      <SortIcon columnKey="realization" />
                    </th>
                    <th
                      className="px-4 py-3 text-center text-sm font-semibold cursor-pointer hover:bg-slate-600 transition-colors min-w-[140px]"
                      onClick={() => handleSort("gap")}
                    >
                      Gap (Kekurangan) <SortIcon columnKey="gap" />
                    </th>
                    <th
                      className="px-4 py-3 text-center text-sm font-semibold cursor-pointer hover:bg-slate-600 transition-colors min-w-[120px]"
                      onClick={() => handleSort("percentage")}
                    >
                      % Terpenuhi <SortIcon columnKey="percentage" />
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold min-w-[100px]">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-12 text-center text-gray-500"
                      >
                        {searchQuery
                          ? `Tidak ada Puskesmas dengan nama "${searchQuery}"`
                          : "Tidak ada data untuk filter ini"}
                      </td>
                    </tr>
                  ) : (
                    filteredAndSortedData.map((pkm, idx) => {
                      const color = getPercentageColor(pkm.percentage);
                      const isLowPerformer =
                        pkm.percentage !== null && pkm.percentage < 50;
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
                            <p className="font-semibold text-gray-800">
                              {pkm.name}
                            </p>
                            <p className="text-xs text-gray-500">{pkm.code}</p>
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-semibold text-gray-800 tabular-nums">
                            {pkm.target.toLocaleString("id-ID")}
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-semibold text-emerald-600 tabular-nums">
                            {pkm.realization.toLocaleString("id-ID")}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`font-semibold tabular-nums ${pkm.gap > 0 ? "text-red-600" : "text-emerald-600"}`}
                            >
                              {pkm.gap > 0
                                ? `-${pkm.gap.toLocaleString("id-ID")}`
                                : "0"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-block px-3 py-1 rounded-lg font-bold text-sm ${color.bg} ${color.text}`}
                            >
                              {formatPercentage(pkm.percentage)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {pkm.percentage === null ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
                                — N/A
                              </span>
                            ) : pkm.percentage >= 100 ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                                ✓ CUKUP
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">
                                ✗ KURANG
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

            {/* Table Footer */}
            {filteredAndSortedData.length > 0 && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
                  <div className="flex items-center gap-6">
                    <span className="text-gray-600">
                      <strong className="text-emerald-600">
                        {summary.pkmComplete}
                      </strong>{" "}
                      Puskesmas terpenuhi (≥100%)
                    </span>
                    <span className="text-gray-600">
                      <strong className="text-red-600">
                        {summary.pkmWithGap}
                      </strong>{" "}
                      Puskesmas kekurangan
                    </span>
                  </div>
                  <p className="text-gray-500">
                    Total: <strong>{filteredAndSortedData.length}</strong>{" "}
                    Puskesmas
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-gray-400 py-4">
            Data diperbarui secara realtime dari Supabase • Dinas Kesehatan Kab.
            Morowali Utara
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
