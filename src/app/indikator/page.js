"use client";
import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";

export default function IndikatorPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const { data: result, error } = await supabase
        .from("achievements")
        .select("*")
        .order("indicator_name", { ascending: true });

      if (error) throw error;
      setData(result || []);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }

  // Group data by indicator (excluding KAB to avoid double counting)
  const indicatorData = useMemo(() => {
    const grouped = data
      .filter((d) => d.puskesmas_code !== "KAB")
      .reduce((acc, curr) => {
        if (!acc[curr.indicator_name]) {
          acc[curr.indicator_name] = {
            indicator_name: curr.indicator_name,
            total_target: 0,
            total_realization: 0,
          };
        }
        acc[curr.indicator_name].total_target +=
          parseFloat(curr.target_qty) || 0;
        acc[curr.indicator_name].total_realization +=
          parseFloat(curr.realization_qty) || 0;
        return acc;
      }, {});

    return Object.values(grouped).map((item, index) => ({
      ...item,
      no: index + 1,
      satuan: "Orang",
      percentage:
        item.total_target > 0
          ? ((item.total_realization / item.total_target) * 100).toFixed(1)
          : 0,
      status:
        item.total_target > 0 && item.total_realization >= item.total_target
          ? "Tuntas"
          : "Belum Tuntas",
    }));
  }, [data]);

  // Sorting logic
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return indicatorData;

    return [...indicatorData].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Handle percentage as number
      if (sortConfig.key === "percentage") {
        aValue = parseFloat(aValue);
        bValue = parseFloat(bValue);
      }

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [indicatorData, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  // Summary Statistics
  const summary = useMemo(() => {
    const totalTarget = indicatorData.reduce(
      (sum, d) => sum + d.total_target,
      0,
    );
    const totalRealization = indicatorData.reduce(
      (sum, d) => sum + d.total_realization,
      0,
    );
    const completedCount = indicatorData.filter(
      (d) => d.status === "Tuntas",
    ).length;

    return {
      totalIndicators: indicatorData.length,
      totalTarget,
      totalRealization,
      completedCount,
      overallPercentage:
        totalTarget > 0
          ? ((totalRealization / totalTarget) * 100).toFixed(1)
          : 0,
    };
  }, [indicatorData]);

  // Get progress bar color based on percentage
  const getProgressColor = (percentage) => {
    const pct = parseFloat(percentage);
    if (pct >= 100) return "bg-emerald-500";
    if (pct >= 75) return "bg-blue-500";
    if (pct >= 50) return "bg-amber-500";
    return "bg-rose-500";
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
              <div className="h-8 bg-gray-200 rounded w-72 mb-2"></div>
              <div className="h-4 bg-gray-100 rounded w-96 mb-6"></div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="bg-white p-5 rounded-xl shadow-sm border border-gray-100"
                  >
                    <div className="h-4 bg-gray-100 rounded w-24 mb-3"></div>
                    <div className="h-8 bg-gray-200 rounded w-20"></div>
                  </div>
                ))}
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
              Capaian Per Indikator
            </h1>
            <p className="text-gray-500 mt-1">
              Detail capaian berdasarkan indikator SPM Hipertensi
            </p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Jumlah Indikator
              </p>
              <p className="text-2xl font-bold text-slate-700 mt-2">
                {summary.totalIndicators}
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
                Indikator Tuntas
              </p>
              <p className="text-2xl font-bold text-emerald-600 mt-2">
                {summary.completedCount} / {summary.totalIndicators}
              </p>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  Tabel Capaian Indikator
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
                      className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => handleSort("indicator_name")}
                    >
                      <div className="flex items-center">
                        Indikator
                        <SortIndicator columnKey="indicator_name" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700 w-24">
                      Satuan
                    </th>
                    <th
                      className="px-4 py-3 text-right font-semibold text-gray-700 cursor-pointer hover:bg-slate-100 transition-colors w-32"
                      onClick={() => handleSort("total_target")}
                    >
                      <div className="flex items-center justify-end">
                        Total Target
                        <SortIndicator columnKey="total_target" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-right font-semibold text-gray-700 cursor-pointer hover:bg-slate-100 transition-colors w-32"
                      onClick={() => handleSort("total_realization")}
                    >
                      <div className="flex items-center justify-end">
                        Total Realisasi
                        <SortIndicator columnKey="total_realization" />
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
                    <th
                      className="px-4 py-3 text-center font-semibold text-gray-700 cursor-pointer hover:bg-slate-100 transition-colors w-28"
                      onClick={() => handleSort("status")}
                    >
                      <div className="flex items-center justify-center">
                        Status
                        <SortIndicator columnKey="status" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData.map((item, idx) => (
                    <tr
                      key={item.indicator_name}
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                      }`}
                    >
                      <td className="px-4 py-3 text-gray-600">{idx + 1}</td>
                      <td className="px-4 py-3 text-gray-800 font-medium">
                        {item.indicator_name}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {item.satuan}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-800 tabular-nums">
                        {item.total_target.toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-800 tabular-nums">
                        {item.total_realization.toLocaleString("id-ID")}
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
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            item.status === "Tuntas"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {item.status === "Tuntas" ? (
                            <svg
                              className="w-3.5 h-3.5 mr-1"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="w-3.5 h-3.5 mr-1"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          )}
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="p-4 bg-slate-50 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Menampilkan {sortedData.length} indikator</span>
                <span className="font-medium">
                  Rata-rata Capaian:{" "}
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
