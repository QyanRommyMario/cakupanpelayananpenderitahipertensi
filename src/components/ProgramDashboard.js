"use client";
import { useState, useEffect, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";
import { EmptyState, DashboardSkeleton } from "@/components/LoadingStates";
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
  isValidProgramType,
  getProgramLabel,
  getProgram,
  PROGRAMS,
  getPartAIndicators,
  getPartBBarangIndicators,
  getPartBSDMIndicators,
  isPartAIndicator,
} from "@/utils/constants";

// Static Color Palette
const COLORS = {
  emerald: "#10b981",
  rose: "#f43f5e",
  slate: "#64748b",
  blue: "#3b82f6",
  amber: "#f59e0b",
  violet: "#7c3aed",
};

/**
 * Master Dashboard Component - Reusable untuk semua Program SPM
 * REPLIKASI SEMPURNA dengan Theming Dinamis
 */
export default function ProgramDashboard({ programType, title }) {
  // KEAMANAN: Validasi programType
  if (!programType || !isValidProgramType(programType)) {
    throw new Error(
      `ProgramDashboard: programType tidak valid: "${programType}". Gunakan PROGRAM_TYPES.`,
    );
  }

  // Get program configuration
  const programConfig = getProgram(programType);
  const theme = programConfig.theme;
  const dashboardTitle = title || `Dashboard ${programConfig.label}`;

  // State Management
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [puskesmasMaster, setPuskesmasMaster] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: "percentage",
    direction: "desc",
  });

  // KEAMANAN: User & Role State
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userPuskesmasCode, setUserPuskesmasCode] = useState(null);
  const [userLoaded, setUserLoaded] = useState(false); // Track if user info is loaded

  // Helper: Check if user is admin from Supabase user_metadata
  // Set di Supabase Dashboard: Authentication > Users > Edit > user_metadata: {"is_admin": true}
  const checkIsAdmin = (user) => {
    return user?.user_metadata?.is_admin === true;
  };

  const periodOptions = useMemo(() => generateTriwulanOptions(), []);

  // Initialize period and fetch user session
  useEffect(() => {
    async function initDashboard() {
      try {
        // Get current user session
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (session) {
          setCurrentUser(session.user);
          const adminStatus = checkIsAdmin(session.user);
          setIsAdmin(adminStatus);

          // Extract puskesmas code from email for non-admin users
          if (!adminStatus) {
            const emailCode = session.user.email.split("@")[0].toUpperCase();
            setUserPuskesmasCode(emailCode);
          }
        }
      } catch (err) {
        logger.error("Error fetching user session", err);
      } finally {
        setUserLoaded(true); // Mark user info as loaded
      }
    }

    initDashboard();
    setSelectedPeriod(getCurrentPeriod());
  }, []);

  // Fetch master puskesmas data
  useEffect(() => {
    async function fetchMasterData() {
      try {
        const { data: pkmData, error } = await supabase
          .from("puskesmas")
          .select("*")
          .order("name");

        if (error) throw error;
        setPuskesmasMaster(pkmData || []);
      } catch (err) {
        logger.error("Error fetching master data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchMasterData();
  }, []);

  // Fetch achievements by program type and period
  // KEAMANAN: Filter berdasarkan role user (puskesmas hanya melihat data sendiri)
  useEffect(() => {
    async function fetchData() {
      // PENTING: Tunggu sampai user info ter-load
      if (!selectedPeriod || !userLoaded) return;

      try {
        setLoadingData(true);

        let query = supabase
          .from("achievements")
          .select("*")
          .neq("puskesmas_code", "KAB")
          .eq("program_type", programType);

        // KEAMANAN: Jika user bukan admin, WAJIB filter ke puskesmas mereka sendiri
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

        const { data: achievements, error } =
          await query.order("puskesmas_code");

        if (error) throw error;
        setData(achievements || []);
      } catch (err) {
        logger.error("Error fetching data", err, { programType, selectedPeriod });
      } finally {
        setLoadingData(false);
      }
    }

    fetchData();
  }, [selectedPeriod, programType, isAdmin, userPuskesmasCode, userLoaded]);

  // ============================================
  // COMPUTED DATA - Sama persis seperti sebelumnya
  // ============================================

  // Summary Statistics
  const summaryStats = useMemo(() => {
    const filteredData = data.filter((d) => d.puskesmas_code !== "KAB");

    const totalTarget = filteredData.reduce(
      (sum, d) => sum + (parseFloat(d.target_qty) || 0),
      0,
    );
    const totalRealization = filteredData.reduce(
      (sum, d) => sum + (parseFloat(d.realization_qty) || 0),
      0,
    );
    const totalUnserved = Math.max(0, totalTarget - totalRealization);
    const percentage =
      totalTarget > 0 ? ((totalRealization / totalTarget) * 100).toFixed(1) : 0;

    return {
      totalTarget,
      totalRealization,
      totalUnserved,
      percentage: parseFloat(percentage),
    };
  }, [data]);

  // Pie Chart Data
  const pieChartData = useMemo(() => {
    return [
      {
        name: "Sudah Terlayani",
        value: summaryStats.totalRealization,
        color: theme.chartPrimary,
      },
      {
        name: "Belum Terlayani",
        value: summaryStats.totalUnserved,
        color: COLORS.slate,
      },
    ];
  }, [summaryStats, theme]);

  // Puskesmas Aggregated Data (untuk tabel dan chart)
  const puskesmasAggregated = useMemo(() => {
    const pkmTotals = {};

    data
      .filter((d) => d.puskesmas_code !== "KAB")
      .forEach((row) => {
        if (!pkmTotals[row.puskesmas_code]) {
          pkmTotals[row.puskesmas_code] = {
            code: row.puskesmas_code,
            target: 0,
            realization: 0,
          };
        }
        pkmTotals[row.puskesmas_code].target += parseFloat(row.target_qty) || 0;
        pkmTotals[row.puskesmas_code].realization +=
          parseFloat(row.realization_qty) || 0;
      });

    return Object.values(pkmTotals)
      .map((p) => {
        const pkm = puskesmasMaster.find((m) => m.code === p.code);
        const percentage =
          p.target > 0 ? ((p.realization / p.target) * 100).toFixed(1) : 0;
        return {
          ...p,
          name: pkm?.name || p.code,
          percentage: parseFloat(percentage),
          unserved: Math.max(0, p.target - p.realization),
          isTuntas: parseFloat(percentage) >= 100,
        };
      })
      .sort((a, b) => b.percentage - a.percentage);
  }, [data, puskesmasMaster]);

  // ============================================
  // SECTION A: Data Layanan Dasar (Sasaran Manusia)
  // ============================================
  const partAIndicators = useMemo(
    () => getPartAIndicators(programType),
    [programType],
  );

  const sectionAData = useMemo(() => {
    const pkmTotals = {};

    data
      .filter(
        (d) =>
          d.puskesmas_code !== "KAB" &&
          partAIndicators.includes(d.indicator_name),
      )
      .forEach((row) => {
        if (!pkmTotals[row.puskesmas_code]) {
          pkmTotals[row.puskesmas_code] = {
            code: row.puskesmas_code,
            target: 0,
            realization: 0,
          };
        }
        pkmTotals[row.puskesmas_code].target += parseFloat(row.target_qty) || 0;
        pkmTotals[row.puskesmas_code].realization +=
          parseFloat(row.realization_qty) || 0;
      });

    return Object.values(pkmTotals)
      .map((p) => {
        const pkm = puskesmasMaster.find((m) => m.code === p.code);
        const percentage =
          p.target > 0 ? ((p.realization / p.target) * 100).toFixed(1) : null;
        return {
          ...p,
          name: pkm?.name || p.code,
          percentage: percentage !== null ? parseFloat(percentage) : null,
          unserved: Math.max(0, p.target - p.realization),
          isTuntas: percentage !== null && parseFloat(percentage) >= 100,
        };
      })
      .sort((a, b) => (b.percentage ?? -1) - (a.percentage ?? -1));
  }, [data, puskesmasMaster, partAIndicators]);

  const sectionAStats = useMemo(() => {
    const totalTarget = sectionAData.reduce((sum, p) => sum + p.target, 0);
    const totalRealization = sectionAData.reduce(
      (sum, p) => sum + p.realization,
      0,
    );
    const totalUnserved = sectionAData.reduce((sum, p) => sum + p.unserved, 0);
    const percentage =
      totalTarget > 0
        ? ((totalRealization / totalTarget) * 100).toFixed(1)
        : "N/A";
    return { totalTarget, totalRealization, totalUnserved, percentage };
  }, [sectionAData]);

  // ============================================
  // SECTION B: Data Mutu Layanan (Sumber Daya)
  // ============================================
  const partBBarangIndicators = useMemo(
    () => getPartBBarangIndicators(programType),
    [programType],
  );
  const partBSDMIndicators = useMemo(
    () => getPartBSDMIndicators(programType),
    [programType],
  );

  // Aggregasi per Indikator (untuk Section B - Barang)
  const sectionBBarangData = useMemo(() => {
    const indTotals = {};

    data
      .filter(
        (d) =>
          d.puskesmas_code !== "KAB" &&
          partBBarangIndicators.includes(d.indicator_name),
      )
      .forEach((row) => {
        if (!indTotals[row.indicator_name]) {
          indTotals[row.indicator_name] = {
            indicator: row.indicator_name,
            target: 0,
            realization: 0,
          };
        }
        indTotals[row.indicator_name].target += parseFloat(row.target_qty) || 0;
        indTotals[row.indicator_name].realization +=
          parseFloat(row.realization_qty) || 0;
      });

    return Object.values(indTotals)
      .map((ind) => {
        const percentage =
          ind.target > 0
            ? ((ind.realization / ind.target) * 100).toFixed(1)
            : null;
        return {
          ...ind,
          percentage: percentage !== null ? parseFloat(percentage) : null,
          gap: Math.max(0, ind.target - ind.realization),
          isTuntas: percentage !== null && parseFloat(percentage) >= 100,
        };
      })
      .sort((a, b) => (a.percentage ?? 999) - (b.percentage ?? 999)); // Worst first
  }, [data, partBBarangIndicators]);

  // Aggregasi per Indikator (untuk Section B - SDM)
  const sectionBSDMData = useMemo(() => {
    const indTotals = {};

    data
      .filter(
        (d) =>
          d.puskesmas_code !== "KAB" &&
          partBSDMIndicators.includes(d.indicator_name),
      )
      .forEach((row) => {
        if (!indTotals[row.indicator_name]) {
          indTotals[row.indicator_name] = {
            indicator: row.indicator_name,
            target: 0,
            realization: 0,
          };
        }
        indTotals[row.indicator_name].target += parseFloat(row.target_qty) || 0;
        indTotals[row.indicator_name].realization +=
          parseFloat(row.realization_qty) || 0;
      });

    return Object.values(indTotals)
      .map((ind) => {
        const percentage =
          ind.target > 0
            ? ((ind.realization / ind.target) * 100).toFixed(1)
            : null;
        return {
          ...ind,
          percentage: percentage !== null ? parseFloat(percentage) : null,
          gap: Math.max(0, ind.target - ind.realization),
          isTuntas: percentage !== null && parseFloat(percentage) >= 100,
        };
      })
      .sort((a, b) => (a.percentage ?? 999) - (b.percentage ?? 999)); // Worst first
  }, [data, partBSDMIndicators]);

  const sectionBStats = useMemo(() => {
    const allData = [...sectionBBarangData, ...sectionBSDMData];
    const totalIndicators = allData.length;
    const completedIndicators = allData.filter((d) => d.isTuntas).length;
    return { totalIndicators, completedIndicators };
  }, [sectionBBarangData, sectionBSDMData]);

  // Top 5 Puskesmas for Bar Chart
  const top5Puskesmas = useMemo(() => {
    return puskesmasAggregated.slice(0, 5);
  }, [puskesmasAggregated]);

  // Sorting function
  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  // Filter and sort data for table
  const filteredAndSortedData = useMemo(() => {
    let filtered = puskesmasAggregated;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.code.toLowerCase().includes(query),
      );
    }

    // Apply sorting
    return [...filtered].sort((a, b) => {
      const aVal = a[sortConfig.key] ?? 0;
      const bVal = b[sortConfig.key] ?? 0;
      if (sortConfig.key === "name" || sortConfig.key === "code") {
        return sortConfig.direction === "asc"
          ? String(aVal).localeCompare(String(bVal), "id")
          : String(bVal).localeCompare(String(aVal), "id");
      }
      return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [puskesmasAggregated, searchQuery, sortConfig]);

  // Color scale function for cells
  const getScoreColor = (percentage) => {
    if (percentage === null)
      return { bg: "bg-gray-100", text: "text-gray-500", bar: "#9ca3af" };
    if (percentage >= 100)
      return { bg: "bg-emerald-100", text: "text-emerald-800", bar: "#10b981" };
    if (percentage >= 80)
      return { bg: "bg-emerald-50", text: "text-emerald-700", bar: "#34d399" };
    if (percentage >= 50)
      return { bg: "bg-amber-100", text: "text-amber-800", bar: "#f59e0b" };
    if (percentage > 0)
      return { bg: "bg-red-100", text: "text-red-800", bar: "#ef4444" };
    return { bg: "bg-gray-100", text: "text-gray-500", bar: "#9ca3af" };
  };

  // Sort indicator icon
  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return <span className="text-white/50 ml-1">↕</span>;
    }
    return (
      <span className="text-yellow-300 ml-1">
        {sortConfig.direction === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  // Period Label
  const periodLabel = useMemo(
    () => formatPeriodLabel(selectedPeriod),
    [selectedPeriod],
  );

  // ============================================
  // TOOLTIP COMPONENTS
  // ============================================

  const PieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0];
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200 text-sm">
          <p className="font-semibold text-gray-800">{d.name}</p>
          <p className="text-gray-600">
            Jumlah:{" "}
            <span className="font-medium">
              {d.value.toLocaleString("id-ID")}
            </span>
          </p>
          <p className="text-gray-600">
            Persentase:{" "}
            <span className="font-medium">
              {((d.value / (summaryStats.totalTarget || 1)) * 100).toFixed(1)}%
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  const BarTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200 text-sm">
          <p className="font-semibold text-gray-800 mb-1">{label}</p>
          <p style={{ color: theme.chartPrimary }}>
            Capaian: <span className="font-bold">{payload[0]?.value}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  // ============================================
  // LOADING STATE
  // ============================================

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 bg-gray-50 min-h-screen">
          <div className="max-w-7xl mx-auto">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-64 mb-2"></div>
              <div className="h-4 bg-gray-100 rounded w-96 mb-6"></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="bg-white p-6 rounded-xl shadow-sm border border-gray-100"
                  >
                    <div className="h-4 bg-gray-100 rounded w-24 mb-3"></div>
                    <div className="h-8 bg-gray-200 rounded w-32"></div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96"></div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96"></div>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ============================================
  // MAIN RENDER
  // ============================================

  return (
    <DashboardLayout>
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {/* ============================================ */}
          {/* HEADER WITH PERIOD FILTER */}
          {/* ============================================ */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{programConfig.icon}</span>
                <h1 className="text-2xl font-bold text-gray-800">
                  {dashboardTitle}
                </h1>
              </div>
              <p className="text-gray-500 mt-1 ml-12">
                Laporan Kinerja Periode:{" "}
                <span className={`font-semibold ${theme.text}`}>
                  {periodLabel}
                </span>
              </p>
              {/* KEAMANAN: Tampilkan info puskesmas untuk non-admin */}
              {!isAdmin && userPuskesmasCode && (
                <p className="text-sm text-blue-600 mt-1 ml-12 bg-blue-50 inline-block px-3 py-1 rounded-full">
                  📍 Data Puskesmas:{" "}
                  <span className="font-bold">{userPuskesmasCode}</span>
                </p>
              )}
              {isAdmin && (
                <p className="text-sm text-emerald-600 mt-1 ml-12 bg-emerald-50 inline-block px-3 py-1 rounded-full">
                  👑 Mode Admin: Melihat semua puskesmas
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600 font-medium">
                Periode:
              </label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className={`px-4 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:ring-2 focus:${theme.ring} focus:border-transparent min-w-[220px]`}
              >
                {periodOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {loadingData && (
                <div
                  className={`animate-spin rounded-full h-5 w-5 border-b-2`}
                  style={{ borderColor: theme.primary }}
                ></div>
              )}
            </div>
          </div>

          {/* Annual Period Indicator */}
          {isAnnualPeriod(selectedPeriod) && (
            <div
              className={`mb-6 ${theme.bgLighter} border ${theme.border} rounded-xl p-4 flex items-center gap-3`}
            >
              <svg
                className={`w-6 h-6 ${theme.text}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <div>
                <p className={`font-semibold ${theme.textDark}`}>
                  Mode Rekap Tahunan
                </p>
                <p className={`text-sm ${theme.text}`}>
                  Menampilkan akumulasi data dari seluruh periode bulan
                </p>
              </div>
            </div>
          )}

          {/* No Data Warning */}
          {!loadingData && data.length === 0 && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
              <svg
                className="w-12 h-12 text-amber-500 mx-auto mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <h2 className="text-lg font-semibold text-amber-800">
                Belum Ada Data
              </h2>
              <p className="text-amber-700 mt-2">
                Data untuk program <strong>{programConfig.label}</strong> pada
                periode ini belum tersedia.
                <br />
                Silakan input data melalui menu{" "}
                <strong>Input / Edit Data</strong>.
              </p>
            </div>
          )}

          {/* ============================================ */}
          {/* SUMMARY CARDS */}
          {/* ============================================ */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Total Sasaran */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                    Total Sasaran
                  </p>
                  <p className="text-3xl font-bold text-slate-700 mt-2">
                    {summaryStats.totalTarget.toLocaleString("id-ID")}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Target Pelayanan SPM
                  </p>
                </div>
                <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center">
                  <svg
                    className="w-7 h-7 text-slate-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Total Terlayani - With Theme Color */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                    Total Terlayani
                  </p>
                  <p
                    className={`text-3xl font-bold mt-2`}
                    style={{ color: theme.primary }}
                  >
                    {summaryStats.totalRealization.toLocaleString("id-ID")}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Sudah Mendapat Pelayanan
                  </p>
                </div>
                <div
                  className={`w-14 h-14 ${theme.bgLight} rounded-xl flex items-center justify-center`}
                >
                  <svg
                    className={`w-7 h-7 ${theme.text}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Persentase Capaian */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                    Rata-rata Capaian
                  </p>
                  <p
                    className={`text-3xl font-bold mt-2 ${summaryStats.percentage >= 100 ? "text-emerald-600" : "text-amber-600"}`}
                  >
                    {summaryStats.percentage}%
                  </p>
                  <div className="mt-2 w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500`}
                      style={{
                        width: `${Math.min(summaryStats.percentage, 100)}%`,
                        backgroundColor:
                          summaryStats.percentage >= 100
                            ? COLORS.emerald
                            : theme.primary,
                      }}
                    ></div>
                  </div>
                </div>
                <div
                  className={`w-14 h-14 ${summaryStats.percentage >= 100 ? "bg-emerald-100" : theme.bgLight} rounded-xl flex items-center justify-center`}
                >
                  <svg
                    className={`w-7 h-7 ${summaryStats.percentage >= 100 ? "text-emerald-600" : theme.text}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* ============================================ */}
          {/* CHARTS SECTION */}
          {/* ============================================ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Pie Chart */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                Distribusi Pelayanan
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Perbandingan jumlah yang sudah dan belum terlayani
              </p>
              <div className="h-[300px] min-h-[280px]">
                <ResponsiveContainer width="100%" height="100%" minHeight={280}>
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name}: ${(percent * 100).toFixed(1)}%`
                      }
                      labelLine={false}
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-2 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: theme.chartPrimary }}
                  ></div>
                  <span className="text-sm text-gray-600">
                    Terlayani:{" "}
                    <span className="font-semibold">
                      {summaryStats.totalRealization.toLocaleString("id-ID")}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-slate-400"></div>
                  <span className="text-sm text-gray-600">
                    Belum:{" "}
                    <span className="font-semibold">
                      {summaryStats.totalUnserved.toLocaleString("id-ID")}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Bar Chart - Top 5 Puskesmas */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                Top 5 Puskesmas
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Puskesmas dengan persentase capaian tertinggi
              </p>
              <div className="h-[300px] min-h-[280px]">
                <ResponsiveContainer width="100%" height="100%" minHeight={280}>
                  <BarChart
                    data={top5Puskesmas}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 60, bottom: 10 }}
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
                      dataKey="code"
                      tick={{ fontSize: 11, fill: "#6b7280" }}
                      width={50}
                    />
                    <Tooltip content={<BarTooltip />} />
                    <Bar
                      dataKey="percentage"
                      fill={theme.chartPrimary}
                      radius={[0, 4, 4, 0]}
                      maxBarSize={30}
                      name="Capaian"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {top5Puskesmas.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div
                    className={`flex items-center justify-between ${theme.bgLighter} rounded-lg p-3`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 ${theme.bg} rounded-full flex items-center justify-center`}
                      >
                        <svg
                          className="w-5 h-5 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          Top Performer
                        </p>
                        <p className="text-xs text-gray-600">
                          {top5Puskesmas[0]?.name}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-2xl font-bold`}
                        style={{ color: theme.primary }}
                      >
                        {top5Puskesmas[0]?.percentage}%
                      </p>
                      <p className="text-xs text-gray-500">Capaian</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ============================================ */}
          {/* SECTION A: SPM LAYANAN DASAR (MANUSIA) */}
          {/* ============================================ */}
          {sectionAData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
              {/* Section A Header - Theme Dark */}
              <div className={`px-6 py-4 ${theme.bg} text-white`}>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      👥 BAGIAN A: SPM Layanan Dasar (Sasaran Penduduk)
                    </h2>
                    <p className="text-white/80 text-sm mt-1">
                      Jumlah warga yang harus dilayani vs yang sudah terlayani
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold">
                      {sectionAStats.percentage === "N/A"
                        ? "N/A"
                        : `${sectionAStats.percentage}%`}
                    </p>
                    <p className="text-white/80 text-sm">Capaian Layanan</p>
                  </div>
                </div>
              </div>

              {/* Highlight Card */}
              <div
                className={`px-6 py-4 ${theme.bgLighter} border-b ${theme.border}`}
              >
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <p className="text-xs text-gray-500 uppercase font-medium">
                      Sasaran Penduduk
                    </p>
                    <p className="text-2xl font-bold text-gray-800 mt-1">
                      {sectionAStats.totalTarget.toLocaleString("id-ID")}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <p className="text-xs text-gray-500 uppercase font-medium">
                      Warga Terlayani
                    </p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">
                      {sectionAStats.totalRealization.toLocaleString("id-ID")}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-red-500">
                    <p className="text-xs text-gray-500 uppercase font-medium">
                      Warga Belum Terlayani
                    </p>
                    <p
                      className={`text-2xl font-bold mt-1 ${sectionAStats.totalUnserved > 0 ? "text-red-600" : "text-emerald-600"}`}
                    >
                      {sectionAStats.totalUnserved.toLocaleString("id-ID")}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <p className="text-xs text-gray-500 uppercase font-medium">
                      Puskesmas Tuntas
                    </p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">
                      {sectionAData.filter((p) => p.isTuntas).length}{" "}
                      <span className="text-sm text-gray-400">
                        / {sectionAData.length}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Section A Table */}
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 z-10">
                    <tr style={{ backgroundColor: theme.primary }}>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-white w-12">
                        No
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-white">
                        Puskesmas
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-white">
                        Sasaran (Target)
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-white">
                        Terlayani (Realisasi)
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-white">
                        Belum Terlayani (Gap)
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-white">
                        % Capaian
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-white">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectionAData.map((pkm, idx) => {
                      const scoreColor = getScoreColor(pkm.percentage);
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
                          <td className="px-4 py-3 text-center text-sm text-gray-600 font-medium">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-semibold text-gray-800">
                              {pkm.name}
                            </p>
                            <p className="text-xs text-gray-500">{pkm.code}</p>
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-800 font-semibold tabular-nums">
                            {pkm.target.toLocaleString("id-ID")}
                          </td>
                          <td
                            className="px-4 py-3 text-center text-sm font-semibold tabular-nums"
                            style={{ color: theme.primary }}
                          >
                            {pkm.realization.toLocaleString("id-ID")}
                          </td>
                          <td
                            className={`px-4 py-3 text-center text-sm font-semibold tabular-nums ${pkm.unserved > 0 ? "text-red-600" : "text-emerald-600"}`}
                          >
                            {pkm.unserved > 0
                              ? `-${pkm.unserved.toLocaleString("id-ID")}`
                              : "0"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-block px-3 py-1 rounded-lg font-bold text-sm ${scoreColor.bg} ${scoreColor.text}`}
                            >
                              {pkm.percentage !== null
                                ? `${pkm.percentage}%`
                                : "N/A"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {pkm.percentage === null ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
                                — N/A
                              </span>
                            ) : pkm.isTuntas ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                                ✓ TUNTAS
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">
                                ✗ BELUM
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============================================ */}
          {/* SECTION B: SPM MUTU LAYANAN (SUMBER DAYA) */}
          {/* ============================================ */}
          {(sectionBBarangData.length > 0 || sectionBSDMData.length > 0) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
              {/* Section B Header - Neutral/Light */}
              <div className="px-6 py-4 bg-slate-100 border-b border-slate-200">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      🔧 BAGIAN B: SPM Mutu Layanan (Sumber Daya)
                    </h2>
                    <p className="text-slate-600 text-sm mt-1">
                      Ketersediaan obat, alat kesehatan, dan SDM pendukung
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-800">
                      {sectionBStats.completedIndicators} /{" "}
                      {sectionBStats.totalIndicators}
                    </p>
                    <p className="text-slate-600 text-sm">
                      Indikator Terpenuhi
                    </p>
                  </div>
                </div>
              </div>

              {/* Sub-section B1: Barang/Alat/Obat */}
              {sectionBBarangData.length > 0 && (
                <div className="border-b border-gray-200">
                  <div className="px-6 py-3 bg-amber-50 border-b border-amber-100">
                    <h3 className="font-semibold text-amber-800 flex items-center gap-2">
                      💊 B.1 Ketersediaan Obat & Alat Kesehatan
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-200">
                          <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700 w-12">
                            No
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                            Indikator
                          </th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">
                            Kebutuhan (Target)
                          </th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">
                            Tersedia (Realisasi)
                          </th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">
                            Kekurangan (Gap)
                          </th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700 min-w-[200px]">
                            % Ketersediaan
                          </th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sectionBBarangData.map((ind, idx) => {
                          const scoreColor = getScoreColor(ind.percentage);
                          const isLow =
                            ind.percentage !== null && ind.percentage < 50;
                          return (
                            <tr
                              key={ind.indicator}
                              className={`
                                border-b border-gray-100 transition-colors
                                ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                                ${isLow ? "!bg-red-50/50" : ""}
                                hover:bg-blue-50
                              `}
                            >
                              <td className="px-4 py-3 text-center text-sm text-gray-600 font-medium">
                                {idx + 1}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-800 font-medium">
                                {ind.indicator}
                              </td>
                              <td className="px-4 py-3 text-center text-sm text-gray-800 font-semibold tabular-nums">
                                {ind.target.toLocaleString("id-ID")}
                              </td>
                              <td className="px-4 py-3 text-center text-sm font-semibold tabular-nums text-emerald-600">
                                {ind.realization.toLocaleString("id-ID")}
                              </td>
                              <td
                                className={`px-4 py-3 text-center text-sm font-semibold tabular-nums ${ind.gap > 0 ? "text-red-600" : "text-emerald-600"}`}
                              >
                                {ind.gap > 0
                                  ? `-${ind.gap.toLocaleString("id-ID")}`
                                  : "0"}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-500`}
                                      style={{
                                        width: `${Math.min(ind.percentage ?? 0, 100)}%`,
                                        backgroundColor:
                                          scoreColor.bar || theme.chartPrimary,
                                      }}
                                    ></div>
                                  </div>
                                  <span
                                    className={`text-sm font-bold tabular-nums w-14 text-right ${scoreColor.text}`}
                                  >
                                    {ind.percentage !== null
                                      ? `${ind.percentage}%`
                                      : "N/A"}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {ind.percentage === null ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
                                    — N/A
                                  </span>
                                ) : ind.isTuntas ? (
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
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sub-section B2: SDM */}
              {sectionBSDMData.length > 0 && (
                <div>
                  <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
                    <h3 className="font-semibold text-blue-800 flex items-center gap-2">
                      👨‍⚕️ B.2 Ketersediaan Tenaga Kesehatan (SDM)
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-200">
                          <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700 w-12">
                            No
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                            Jenis Tenaga
                          </th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">
                            Kebutuhan (Target)
                          </th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">
                            Tersedia (Realisasi)
                          </th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">
                            Kekurangan (Gap)
                          </th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700 min-w-[200px]">
                            % Ketersediaan
                          </th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sectionBSDMData.map((ind, idx) => {
                          const scoreColor = getScoreColor(ind.percentage);
                          const isLow =
                            ind.percentage !== null && ind.percentage < 50;
                          return (
                            <tr
                              key={ind.indicator}
                              className={`
                                border-b border-gray-100 transition-colors
                                ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                                ${isLow ? "!bg-red-50/50" : ""}
                                hover:bg-blue-50
                              `}
                            >
                              <td className="px-4 py-3 text-center text-sm text-gray-600 font-medium">
                                {idx + 1}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-800 font-medium">
                                {ind.indicator}
                              </td>
                              <td className="px-4 py-3 text-center text-sm text-gray-800 font-semibold tabular-nums">
                                {ind.target.toLocaleString("id-ID")}
                              </td>
                              <td className="px-4 py-3 text-center text-sm font-semibold tabular-nums text-emerald-600">
                                {ind.realization.toLocaleString("id-ID")}
                              </td>
                              <td
                                className={`px-4 py-3 text-center text-sm font-semibold tabular-nums ${ind.gap > 0 ? "text-red-600" : "text-emerald-600"}`}
                              >
                                {ind.gap > 0
                                  ? `-${ind.gap.toLocaleString("id-ID")}`
                                  : "0"}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-500`}
                                      style={{
                                        width: `${Math.min(ind.percentage ?? 0, 100)}%`,
                                        backgroundColor:
                                          scoreColor.bar || theme.chartPrimary,
                                      }}
                                    ></div>
                                  </div>
                                  <span
                                    className={`text-sm font-bold tabular-nums w-14 text-right ${scoreColor.text}`}
                                  >
                                    {ind.percentage !== null
                                      ? `${ind.percentage}%`
                                      : "N/A"}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {ind.percentage === null ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
                                    — N/A
                                  </span>
                                ) : ind.isTuntas ? (
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
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Section B Footer - Link to Detailed Analysis */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    💡 Klik indikator di atas untuk melihat rincian per
                    Puskesmas
                  </p>
                  <a
                    href={`/indikator?program=${programType}`}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${theme.bg} text-white hover:opacity-90 transition-opacity`}
                  >
                    🔬 Analisa Detail Per Indikator
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 text-center text-xs text-gray-400">
            Data diperbarui secara realtime dari Supabase • Dinas Kesehatan Kab.
            Morowali Utara
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
