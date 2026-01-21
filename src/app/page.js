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
import { 
  generateTriwulanOptions, 
  getCurrentPeriod, 
  parsePeriod,
  isAnnualPeriod,
  getQuartersForYear,
  formatPeriodLabel 
} from "@/utils/periods";

// Color Palette
const COLORS = {
  emerald: "#10b981",
  rose: "#f43f5e",
  slate: "#64748b",
  blue: "#3b82f6",
  amber: "#f59e0b",
};

export default function DashboardPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [puskesmasMaster, setPuskesmasMaster] = useState([]);
  
  // Period Filter
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const periodOptions = useMemo(() => generateTriwulanOptions(), []);

  // Initialize with current period
  useEffect(() => {
    const currentPeriod = getCurrentPeriod();
    setSelectedPeriod(currentPeriod);
  }, []);

  // Fetch master data on mount
  useEffect(() => {
    async function fetchMasterData() {
      try {
        const puskesmasRes = await supabase
          .from("puskesmas")
          .select("*")
          .order("name");
        
        if (puskesmasRes.error) throw puskesmasRes.error;
        setPuskesmasMaster(puskesmasRes.data || []);
      } catch (err) {
        console.error("Error fetching master data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchMasterData();
  }, []);

  // Fetch achievements data when period changes
  useEffect(() => {
    async function fetchData() {
      if (!selectedPeriod) return;
      
      try {
        setLoadingData(true);
        
        let query = supabase
          .from("achievements")
          .select("*")
          .neq("puskesmas_code", "KAB");
        
        // Check if annual recap or quarterly
        if (isAnnualPeriod(selectedPeriod)) {
          const parsed = parsePeriod(selectedPeriod);
          const quarters = getQuartersForYear(parsed.year);
          query = query.in("period", quarters);
        } else {
          query = query.eq("period", selectedPeriod);
        }
        
        const { data: achievements, error } = await query
          .order("puskesmas_code", { ascending: true });
        
        if (error) throw error;
        setData(achievements || []);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoadingData(false);
      }
    }
    
    fetchData();
  }, [selectedPeriod]);

  // Calculate summary statistics
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
    const totalUnserved = totalTarget - totalRealization;
    const percentage =
      totalTarget > 0 ? ((totalRealization / totalTarget) * 100).toFixed(1) : 0;

    return {
      totalTarget,
      totalRealization,
      totalUnserved: totalUnserved > 0 ? totalUnserved : 0,
      percentage: parseFloat(percentage),
    };
  }, [data]);

  // Pie Chart Data
  const pieChartData = useMemo(() => {
    return [
      {
        name: "Sudah Terlayani",
        value: summaryStats.totalRealization,
        color: COLORS.emerald,
      },
      {
        name: "Belum Terlayani",
        value: summaryStats.totalUnserved,
        color: COLORS.rose,
      },
    ];
  }, [summaryStats]);

  // Top 5 Puskesmas by Achievement Percentage
  const top5Puskesmas = useMemo(() => {
    const puskesmasData = data
      .filter((d) => d.puskesmas_code !== "KAB")
      .reduce((acc, curr) => {
        if (!acc[curr.puskesmas_code]) {
          acc[curr.puskesmas_code] = {
            code: curr.puskesmas_code,
            target: 0,
            realization: 0,
          };
        }
        acc[curr.puskesmas_code].target += parseFloat(curr.target_qty) || 0;
        acc[curr.puskesmas_code].realization +=
          parseFloat(curr.realization_qty) || 0;
        return acc;
      }, {});

    return Object.values(puskesmasData)
      .map((p) => ({
        ...p,
        name: puskesmasMaster.find((m) => m.code === p.code)?.name || p.code,
        percentage:
          p.target > 0 ? ((p.realization / p.target) * 100).toFixed(1) : 0,
      }))
      .sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage))
      .slice(0, 5);
  }, [data, puskesmasMaster]);

  // Get period display label
  const periodLabel = useMemo(() => {
    return formatPeriodLabel(selectedPeriod);
  }, [selectedPeriod]);

  // Custom Tooltip for Pie Chart
  const PieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0];
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200 text-sm">
          <p className="font-semibold text-gray-800">{d.name}</p>
          <p className="text-gray-600">
            Jumlah: <span className="font-medium">{d.value.toLocaleString("id-ID")}</span>
          </p>
          <p className="text-gray-600">
            Persentase: <span className="font-medium">{((d.value / (summaryStats.totalTarget || 1)) * 100).toFixed(1)}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom Tooltip for Bar Chart
  const BarTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200 text-sm">
          <p className="font-semibold text-gray-800 mb-1">{label}</p>
          <p className="text-emerald-600">
            Capaian: <span className="font-bold">{payload[0]?.value}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  // Loading Skeleton
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
                  <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="h-4 bg-gray-100 rounded w-24 mb-3"></div>
                    <div className="h-8 bg-gray-200 rounded w-32"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {/* Header with Period Filter */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Dashboard SPM Kesehatan</h1>
              <p className="text-gray-500 mt-1">
                Laporan Kinerja Periode: <span className="font-semibold text-blue-600">{periodLabel}</span>
              </p>
            </div>
            
            {/* Period Dropdown */}
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600 font-medium">Periode:</label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[220px]"
              >
                {periodOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {loadingData && (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              )}
            </div>
          </div>

          {/* Period Type Indicator */}
          {isAnnualPeriod(selectedPeriod) && (
            <div className="mb-6 bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center gap-3">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <div>
                <p className="font-semibold text-purple-800">Mode Rekap Tahunan</p>
                <p className="text-sm text-purple-600">Menampilkan akumulasi data dari seluruh Triwulan dalam tahun yang dipilih</p>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Total Sasaran */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Sasaran</p>
                  <p className="text-3xl font-bold text-slate-700 mt-2">{summaryStats.totalTarget.toLocaleString("id-ID")}</p>
                  <p className="text-xs text-gray-400 mt-1">Target Pelayanan SPM</p>
                </div>
                <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Total Terlayani */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Terlayani</p>
                  <p className="text-3xl font-bold text-emerald-600 mt-2">{summaryStats.totalRealization.toLocaleString("id-ID")}</p>
                  <p className="text-xs text-gray-400 mt-1">Sudah Mendapat Pelayanan</p>
                </div>
                <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Rata-rata Capaian */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Rata-rata Capaian</p>
                  <p className={`text-3xl font-bold mt-2 ${summaryStats.percentage >= 100 ? "text-emerald-600" : "text-amber-600"}`}>
                    {summaryStats.percentage}%
                  </p>
                  <div className="mt-2 w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${summaryStats.percentage >= 100 ? "bg-emerald-500" : "bg-amber-500"}`}
                      style={{ width: `${Math.min(summaryStats.percentage, 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div className={`w-14 h-14 ${summaryStats.percentage >= 100 ? "bg-emerald-100" : "bg-amber-100"} rounded-xl flex items-center justify-center`}>
                  <svg className={`w-7 h-7 ${summaryStats.percentage >= 100 ? "text-emerald-600" : "text-amber-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Distribusi Pelayanan</h2>
              <p className="text-sm text-gray-500 mb-4">Perbandingan jumlah yang sudah dan belum terlayani</p>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
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
                  <div className="w-4 h-4 rounded-full bg-emerald-500"></div>
                  <span className="text-sm text-gray-600">Terlayani: <span className="font-semibold">{summaryStats.totalRealization.toLocaleString("id-ID")}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-rose-500"></div>
                  <span className="text-sm text-gray-600">Belum: <span className="font-semibold">{summaryStats.totalUnserved.toLocaleString("id-ID")}</span></span>
                </div>
              </div>
            </div>

            {/* Bar Chart - Top 5 Puskesmas */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Top 5 Puskesmas</h2>
              <p className="text-sm text-gray-500 mb-4">Puskesmas dengan persentase capaian tertinggi</p>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={top5Puskesmas} layout="vertical" margin={{ top: 10, right: 30, left: 60, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#6b7280" }} tickFormatter={(value) => `${value}%`} />
                    <YAxis type="category" dataKey="code" tick={{ fontSize: 11, fill: "#6b7280" }} width={50} />
                    <Tooltip content={<BarTooltip />} />
                    <Bar dataKey="percentage" fill={COLORS.emerald} radius={[0, 4, 4, 0]} maxBarSize={30} name="Capaian" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {top5Puskesmas.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between bg-emerald-50 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Top Performer</p>
                        <p className="text-xs text-gray-600">{top5Puskesmas[0]?.name || top5Puskesmas[0]?.code}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-emerald-600">{top5Puskesmas[0]?.percentage}%</p>
                      <p className="text-xs text-gray-500">Capaian</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center text-xs text-gray-400">
            Data diperbarui secara realtime dari Supabase • Dinas Kesehatan Kab. Morowali Utara
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
