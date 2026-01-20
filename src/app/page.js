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
import { supabase } from "@/lib/supabase";

const PUSKESMAS_LIST = ["ANT", "BTR", "BTL", "KDL", "LEE", "MYB", "MLN", "PMR", "PDK", "PTB", "PTW", "TBY", "TMT", "WGK", "KAB"];

export default function DashboardPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const { data: result, error } = await supabase
        .from("achievements")
        .select("*")
        .order("puskesmas_code", { ascending: true });

      if (error) throw error;
      setData(result);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }

  // Get unique indicators
  const indicators = useMemo(() => {
    return [...new Set(data.map((d) => d.indicator_name))];
  }, [data]);

  // Calculate summary statistics (excluding KAB to avoid double counting)
  const summaryStats = useMemo(() => {
    const filteredData = data.filter((d) => d.puskesmas_code !== "KAB");
    const totalTarget = filteredData.reduce((sum, d) => sum + d.target_qty, 0);
    const totalRealization = filteredData.reduce((sum, d) => sum + d.realization_qty, 0);
    const totalUnserved = filteredData.reduce((sum, d) => sum + d.unserved_qty, 0);
    const percentage = totalTarget > 0 ? ((totalRealization / totalTarget) * 100).toFixed(1) : 0;

    return {
      totalTarget,
      totalRealization,
      totalUnserved,
      percentage,
    };
  }, [data]);

  // Group Data for Chart (Exclude KAB for cleaner chart)
  const chartData = useMemo(() => {
    const pkmOrder = PUSKESMAS_LIST.filter((p) => p !== "KAB");
    const grouped = data
      .filter((d) => d.puskesmas_code !== "KAB")
      .reduce((acc, curr) => {
        if (!acc[curr.puskesmas_code]) {
          acc[curr.puskesmas_code] = {
            name: curr.puskesmas_code,
            Target: 0,
            Realisasi: 0,
          };
        }
        acc[curr.puskesmas_code].Target += curr.target_qty;
        acc[curr.puskesmas_code].Realisasi += curr.realization_qty;
        return acc;
      }, {});
    return pkmOrder.map((pkm) => grouped[pkm]).filter(Boolean);
  }, [data]);

  // Helper to find cell data
  const getCellData = (indicatorName, pkmCode) => {
    return data.find(
      (d) => d.indicator_name === indicatorName && d.puskesmas_code === pkmCode
    );
  };

  // Custom Tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const target = payload.find((p) => p.dataKey === "Target")?.value || 0;
      const realisasi = payload.find((p) => p.dataKey === "Realisasi")?.value || 0;
      const pct = target > 0 ? ((realisasi / target) * 100).toFixed(1) : 0;

      return (
        <div className="bg-white p-3 rounded shadow-lg border border-gray-200 text-sm">
          <p className="font-semibold text-gray-800 mb-1">{label}</p>
          <p className="text-gray-600">
            Sasaran: <span className="font-medium">{target.toLocaleString("id-ID")}</span>
          </p>
          <p className="text-blue-600">
            Realisasi: <span className="font-medium">{realisasi.toLocaleString("id-ID")}</span>
          </p>
          <p className="text-green-700 mt-1 pt-1 border-t border-gray-200">
            Capaian: <span className="font-semibold">{pct}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  // Loading Skeleton
  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-full mx-auto">
          <div className="animate-pulse">
            <div className="h-7 bg-gray-200 rounded w-64 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white p-5 rounded border border-gray-200">
                  <div className="h-4 bg-gray-100 rounded w-20 mb-2"></div>
                  <div className="h-7 bg-gray-200 rounded w-28"></div>
                </div>
              ))}
            </div>
            <div className="bg-white p-5 rounded border border-gray-200 mb-6">
              <div className="h-5 bg-gray-100 rounded w-48 mb-4"></div>
              <div className="h-[300px] bg-gray-50 rounded"></div>
            </div>
            <div className="bg-white p-5 rounded border border-gray-200">
              <div className="h-5 bg-gray-100 rounded w-40 mb-4"></div>
              <div className="h-[200px] bg-gray-50 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-full mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-800">
            Dashboard SPM Hipertensi
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Monitoring Cakupan Pelayanan Penderita Hipertensi
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Total Sasaran */}
          <div className="bg-white p-5 rounded border border-gray-200 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Total Sasaran
            </p>
            <p className="text-2xl font-semibold text-gray-800 mt-1">
              {summaryStats.totalTarget.toLocaleString("id-ID")}
            </p>
          </div>

          {/* Total Realisasi */}
          <div className="bg-white p-5 rounded border border-gray-200 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Total Realisasi
            </p>
            <p className="text-2xl font-semibold text-blue-600 mt-1">
              {summaryStats.totalRealization.toLocaleString("id-ID")}
            </p>
          </div>

          {/* Persentase Capaian */}
          <div className="bg-white p-5 rounded border border-gray-200 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Persentase Capaian
            </p>
            <p className="text-2xl font-semibold text-green-600 mt-1">
              {summaryStats.percentage}%
            </p>
            <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
              <div
                className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(summaryStats.percentage, 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Belum Terlayani */}
          <div className="bg-white p-5 rounded border border-gray-200 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Belum Terlayani
            </p>
            <p className="text-2xl font-semibold text-red-600 mt-1">
              {summaryStats.totalUnserved.toLocaleString("id-ID")}
            </p>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white p-5 rounded border border-gray-200 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">
              Grafik Kinerja per Puskesmas
            </h2>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-slate-400 rounded-sm"></div>
                <span className="text-gray-600">Sasaran</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
                <span className="text-gray-600">Realisasi</span>
              </div>
            </div>
          </div>

          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 20, left: 10, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis
                  dataKey="name"
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
                  width={50}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  height={30}
                  wrapperStyle={{ fontSize: "12px" }}
                />
                <Bar
                  dataKey="Target"
                  fill="#94a3b8"
                  name="Sasaran"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={40}
                />
                <Bar
                  dataKey="Realisasi"
                  fill="#3b82f6"
                  name="Realisasi"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="bg-white rounded border border-gray-200 shadow-sm">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-800">
              Matrix Realisasi per Indikator
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Data realisasi (jumlah) per puskesmas
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-gray-300 p-2 text-left font-semibold text-gray-700 sticky left-0 bg-slate-100 z-10 min-w-[200px]">
                    Indikator
                  </th>
                  {PUSKESMAS_LIST.map((pkm) => (
                    <th
                      key={pkm}
                      className={`border border-gray-300 p-2 text-center font-semibold text-gray-700 min-w-[70px] ${
                        pkm === "KAB" ? "bg-amber-50" : ""
                      }`}
                    >
                      {pkm}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {indicators.map((ind, idx) => (
                  <tr key={ind} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="border border-gray-300 p-2 text-gray-800 font-medium sticky left-0 bg-inherit z-10">
                      {ind}
                    </td>
                    {PUSKESMAS_LIST.map((pkm) => {
                      const cellData = getCellData(ind, pkm);
                      const value = cellData?.realization_qty ?? "-";
                      const isKab = pkm === "KAB";
                      return (
                        <td
                          key={pkm}
                          className={`border border-gray-300 p-2 text-center tabular-nums ${
                            isKab ? "bg-amber-50 font-semibold" : ""
                          }`}
                        >
                          {typeof value === "number"
                            ? value.toLocaleString("id-ID")
                            : value}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 text-center text-xs text-gray-400">
          Data diperbarui secara realtime dari Google Sheets dan Supabase
        </div>
      </div>
    </div>
  );
}
