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
} from "recharts";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";

// Color Palette
const COLORS = {
  emerald: "#10b981",
  rose: "#f43f5e",
  slate: "#64748b",
  blue: "#3b82f6",
  amber: "#f59e0b",
};

// Puskesmas list including KAB
const PUSKESMAS_ORDER = [
  "ANT",
  "BTR",
  "BTL",
  "KDL",
  "LEE",
  "MYB",
  "MLN",
  "PMR",
  "PDK",
  "PTB",
  "PTW",
  "TBY",
  "TMT",
  "WGK",
  "KAB",
];

export default function PuskesmasPage() {
  const [data, setData] = useState([]);
  const [puskesmasMaster, setPuskesmasMaster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({
    key: "code",
    direction: "asc",
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [achievementsRes, puskesmasRes] = await Promise.all([
        supabase
          .from("achievements")
          .select("*")
          .order("puskesmas_code", { ascending: true }),
        supabase.from("puskesmas").select("*").order("name"),
      ]);

      if (achievementsRes.error) throw achievementsRes.error;
      setData(achievementsRes.data || []);
      setPuskesmasMaster(puskesmasRes.data || []);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }

  // Group data by puskesmas (including KAB)
  const puskesmasData = useMemo(() => {
    const grouped = data.reduce((acc, curr) => {
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

    return Object.values(grouped).map((item) => {
      const masterData = puskesmasMaster.find((m) => m.code === item.code);
      return {
        ...item,
        name: masterData?.name || item.code,
        percentage:
          item.target > 0
            ? ((item.realization / item.target) * 100).toFixed(1)
            : 0,
        unserved: Math.max(0, item.target - item.realization),
      };
    });
  }, [data, puskesmasMaster]);

  // Chart data (ordered by PUSKESMAS_ORDER)
  const chartData = useMemo(() => {
    return PUSKESMAS_ORDER.map((code) => {
      const pkm = puskesmasData.find((p) => p.code === code);
      return pkm
        ? {
            code: pkm.code,
            name: pkm.name,
            Target: pkm.target,
            Realisasi: pkm.realization,
          }
        : null;
    }).filter(Boolean);
  }, [puskesmasData]);

  // Sorted table data
  const sortedTableData = useMemo(() => {
    const dataToSort = [...puskesmasData];

    return dataToSort.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      if (sortConfig.key === "percentage") {
        aValue = parseFloat(aValue);
        bValue = parseFloat(bValue);
      }

      // Special sorting for code based on PUSKESMAS_ORDER
      if (sortConfig.key === "code") {
        aValue = PUSKESMAS_ORDER.indexOf(a.code);
        bValue = PUSKESMAS_ORDER.indexOf(b.code);
      }

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [puskesmasData, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  // Summary stats (excluding KAB to avoid double counting)
  const summary = useMemo(() => {
    const filteredData = puskesmasData.filter((p) => p.code !== "KAB");
    const totalTarget = filteredData.reduce((sum, d) => sum + d.target, 0);
    const totalRealization = filteredData.reduce(
      (sum, d) => sum + d.realization,
      0,
    );

    return {
      totalPuskesmas: filteredData.length,
      totalTarget,
      totalRealization,
      overallPercentage:
        totalTarget > 0
          ? ((totalRealization / totalTarget) * 100).toFixed(1)
          : 0,
    };
  }, [puskesmasData]);

  // Get progress bar color based on percentage
  const getProgressColor = (percentage) => {
    const pct = parseFloat(percentage);
    if (pct >= 100) return "bg-emerald-500";
    if (pct >= 75) return "bg-blue-500";
    if (pct >= 50) return "bg-amber-500";
    return "bg-rose-500";
  };

  // Custom Tooltip for Chart
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const target = payload.find((p) => p.dataKey === "Target")?.value || 0;
      const realisasi =
        payload.find((p) => p.dataKey === "Realisasi")?.value || 0;
      const pct = target > 0 ? ((realisasi / target) * 100).toFixed(1) : 0;

      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200 text-sm">
          <p className="font-bold text-gray-800 mb-2 text-base">{label}</p>
          <div className="space-y-1.5">
            <p className="text-slate-600 flex items-center gap-2">
              <span className="w-3 h-3 bg-slate-400 rounded-sm"></span>
              Sasaran:{" "}
              <span className="font-semibold">
                {target.toLocaleString("id-ID")}
              </span>
            </p>
            <p className="text-blue-600 flex items-center gap-2">
              <span className="w-3 h-3 bg-blue-500 rounded-sm"></span>
              Realisasi:{" "}
              <span className="font-semibold">
                {realisasi.toLocaleString("id-ID")}
              </span>
            </p>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-200">
            <p
              className={`font-bold ${parseFloat(pct) >= 100 ? "text-emerald-600" : "text-amber-600"}`}
            >
              Capaian: {pct}%
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Sort indicator
  const SortIndicator = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return (
        <svg
          className="w-4 h-4 text-gray-400 ml-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
          />
        </svg>
      );
    }
    return sortConfig.direction === "asc" ? (
      <svg
        className="w-4 h-4 text-emerald-600 ml-1"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 15l7-7 7 7"
        />
      </svg>
    ) : (
      <svg
        className="w-4 h-4 text-emerald-600 ml-1"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    );
  };

  // Loading Skeleton
  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 bg-gray-50 min-h-screen">
          <div className="max-w-7xl mx-auto">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-80 mb-2"></div>
              <div className="h-4 bg-gray-100 rounded w-96 mb-6"></div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
                <div className="h-5 bg-gray-200 rounded w-48 mb-4"></div>
                <div className="h-[400px] bg-gray-50 rounded"></div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="p-4 border-b border-gray-100">
                  <div className="h-5 bg-gray-200 rounded w-48"></div>
                </div>
                <div className="p-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-gray-50 rounded mb-2"></div>
                  ))}
                </div>
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
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-800">
              Capaian Per Puskesmas
            </h1>
            <p className="text-gray-500 mt-1">
              Perbandingan target dan realisasi setiap puskesmas
            </p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Jumlah Puskesmas
              </p>
              <p className="text-2xl font-bold text-slate-700 mt-2">
                {summary.totalPuskesmas}
              </p>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Total Sasaran
              </p>
              <p className="text-2xl font-bold text-slate-700 mt-2">
                {summary.totalTarget.toLocaleString("id-ID")}
              </p>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Total Realisasi
              </p>
              <p className="text-2xl font-bold text-emerald-600 mt-2">
                {summary.totalRealization.toLocaleString("id-ID")}
              </p>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Rata-rata Capaian
              </p>
              <p
                className={`text-2xl font-bold mt-2 ${parseFloat(summary.overallPercentage) >= 100 ? "text-emerald-600" : "text-amber-600"}`}
              >
                {summary.overallPercentage}%
              </p>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  Grafik Perbandingan Target vs Realisasi
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Visualisasi capaian setiap puskesmas (termasuk KAB)
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 bg-slate-400 rounded"></div>
                  <span className="text-gray-600">Sasaran</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 bg-blue-500 rounded"></div>
                  <span className="text-gray-600">Realisasi</span>
                </div>
              </div>
            </div>

            <div className="h-[420px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e5e7eb"
                  />
                  <XAxis
                    dataKey="code"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    interval={0}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    tickFormatter={(value) => value.toLocaleString("id-ID")}
                    width={60}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    wrapperStyle={{ fontSize: "13px" }}
                  />
                  <Bar
                    dataKey="Target"
                    fill={COLORS.slate}
                    name="Sasaran"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={35}
                  />
                  <Bar
                    dataKey="Realisasi"
                    fill={COLORS.blue}
                    name="Realisasi"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={35}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  Detail Capaian Per Puskesmas
                </h2>
                <p className="text-sm text-gray-500">
                  Klik header kolom untuk mengurutkan data
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                  <span className="text-gray-600">≥100%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-600">≥75%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                  <span className="text-gray-600">≥50%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-rose-500 rounded-full"></div>
                  <span className="text-gray-600">&lt;50%</span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 w-16">
                      No
                    </th>
                    <th
                      className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-slate-100 transition-colors w-24"
                      onClick={() => handleSort("code")}
                    >
                      <div className="flex items-center">
                        Kode
                        <SortIndicator columnKey="code" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center">
                        Nama Puskesmas
                        <SortIndicator columnKey="name" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-right font-semibold text-gray-700 cursor-pointer hover:bg-slate-100 transition-colors w-32"
                      onClick={() => handleSort("target")}
                    >
                      <div className="flex items-center justify-end">
                        Target
                        <SortIndicator columnKey="target" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-right font-semibold text-gray-700 cursor-pointer hover:bg-slate-100 transition-colors w-32"
                      onClick={() => handleSort("realization")}
                    >
                      <div className="flex items-center justify-end">
                        Realisasi
                        <SortIndicator columnKey="realization" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-center font-semibold text-gray-700 cursor-pointer hover:bg-slate-100 transition-colors w-48"
                      onClick={() => handleSort("percentage")}
                    >
                      <div className="flex items-center justify-center">
                        % Capaian
                        <SortIndicator columnKey="percentage" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700 w-32">
                      Belum Terlayani
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTableData.map((item, idx) => (
                    <tr
                      key={item.code}
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                        item.code === "KAB"
                          ? "bg-amber-50/50"
                          : idx % 2 === 0
                            ? "bg-white"
                            : "bg-gray-50/50"
                      }`}
                    >
                      <td className="px-4 py-3 text-gray-600">{idx + 1}</td>
                      <td
                        className={`px-4 py-3 font-semibold ${item.code === "KAB" ? "text-amber-700" : "text-gray-800"}`}
                      >
                        {item.code}
                      </td>
                      <td className="px-4 py-3 text-gray-800">
                        {item.name}
                        {item.code === "KAB" && (
                          <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                            Kabupaten
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-800 tabular-nums">
                        {item.target.toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-800 tabular-nums">
                        {item.realization.toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${getProgressColor(item.percentage)}`}
                              style={{
                                width: `${Math.min(parseFloat(item.percentage), 100)}%`,
                              }}
                            ></div>
                          </div>
                          <span
                            className={`text-sm font-semibold tabular-nums w-14 text-right ${
                              parseFloat(item.percentage) >= 100
                                ? "text-emerald-600"
                                : "text-gray-700"
                            }`}
                          >
                            {item.percentage}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {item.unserved > 0 ? (
                          <span className="text-rose-600 font-medium">
                            {item.unserved.toLocaleString("id-ID")}
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-medium">
                            0
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="p-4 bg-slate-50 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>
                  Menampilkan {sortedTableData.length} puskesmas (termasuk KAB)
                </span>
                <span className="font-medium">
                  Rata-rata Capaian (excl. KAB):{" "}
                  <span
                    className={
                      parseFloat(summary.overallPercentage) >= 100
                        ? "text-emerald-600"
                        : "text-amber-600"
                    }
                  >
                    {summary.overallPercentage}%
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center text-xs text-gray-400">
            Data diperbarui secara realtime dari Google Sheets dan Supabase
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
