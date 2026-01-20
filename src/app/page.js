"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";

export default function DashboardPage() {
  const [data, setData] = useState([]);
  const [puskesmasList, setPuskesmasList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [periods, setPeriods] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    // Load puskesmas
    const { data: puskesmasData } = await supabase
      .from("puskesmas")
      .select("*")
      .order("name");
    setPuskesmasList(puskesmasData || []);

    // Load achievements
    const { data: achievementsData } = await supabase
      .from("achievements")
      .select("*");

    if (achievementsData) {
      setData(achievementsData);
      const uniquePeriods = [...new Set(achievementsData.map((d) => d.period))]
        .sort()
        .reverse();
      setPeriods(uniquePeriods);
      if (uniquePeriods.length > 0) setSelectedPeriod(uniquePeriods[0]);
    }
    setLoading(false);
  };

  const filteredData = data.filter((d) => d.period === selectedPeriod);

  // Calculate percentage for each record
  const calculatePercentage = (target, realization) => {
    if (!target || target === 0) return 0;
    return Math.round((realization / target) * 100);
  };

  // Calculate summary
  const summary = {
    totalPuskesmas: puskesmasList.length,
    totalTarget: filteredData.reduce(
      (a, b) => a + (Number(b.target_qty) || 0),
      0,
    ),
    totalRealization: filteredData.reduce(
      (a, b) => a + (Number(b.realization_qty) || 0),
      0,
    ),
    totalUnserved: filteredData.reduce(
      (a, b) => a + (Number(b.unserved_qty) || 0),
      0,
    ),
  };
  summary.avgPercentage =
    summary.totalTarget > 0
      ? Math.round((summary.totalRealization / summary.totalTarget) * 100)
      : 0;

  // Chart data - grouped by indicator
  const indicatorData = filteredData.reduce((acc, curr) => {
    const existing = acc.find((a) => a.name === curr.indicator_name);
    if (existing) {
      existing.target += Number(curr.target_qty) || 0;
      existing.realization += Number(curr.realization_qty) || 0;
      existing.unserved += Number(curr.unserved_qty) || 0;
    } else {
      acc.push({
        name: curr.indicator_name,
        target: Number(curr.target_qty) || 0,
        realization: Number(curr.realization_qty) || 0,
        unserved: Number(curr.unserved_qty) || 0,
      });
    }
    return acc;
  }, []);

  // Chart data - by puskesmas (percentage)
  const puskesmasChartData = puskesmasList
    .map((p) => {
      const records = filteredData.filter((d) => d.puskesmas_code === p.code);
      const totalTarget = records.reduce(
        (a, b) => a + (Number(b.target_qty) || 0),
        0,
      );
      const totalRealization = records.reduce(
        (a, b) => a + (Number(b.realization_qty) || 0),
        0,
      );
      const pct =
        totalTarget > 0
          ? Math.round((totalRealization / totalTarget) * 100)
          : 0;
      return { name: p.name, percentage: pct };
    })
    .filter((p) => p.percentage > 0);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Dashboard SPM Kesehatan
            </h1>
            <p className="text-gray-500">
              Cakupan Pelayanan Penderita Hipertensi
            </p>
          </div>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            {periods.length === 0 && <option value="">Belum ada data</option>}
            {periods.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white rounded-xl shadow p-6">
                <p className="text-sm text-gray-500">Total Puskesmas</p>
                <p className="text-3xl font-bold text-gray-800">
                  {summary.totalPuskesmas}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow p-6">
                <p className="text-sm text-gray-500">Rata-rata Capaian</p>
                <p className="text-3xl font-bold text-indigo-600">
                  {summary.avgPercentage}%
                </p>
              </div>
              <div className="bg-white rounded-xl shadow p-6">
                <p className="text-sm text-gray-500">Total Sasaran</p>
                <p className="text-3xl font-bold text-gray-800">
                  {summary.totalTarget.toLocaleString()}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow p-6">
                <p className="text-sm text-gray-500">Total Terlayani</p>
                <p className="text-3xl font-bold text-green-600">
                  {summary.totalRealization.toLocaleString()}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow p-6">
                <p className="text-sm text-gray-500">Belum Terlayani</p>
                <p className="text-3xl font-bold text-red-600">
                  {summary.totalUnserved.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Indicator Chart */}
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Capaian per Indikator
                </h3>
                {indicatorData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={indicatorData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={150}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="target" fill="#e0e7ff" name="Sasaran" />
                      <Bar
                        dataKey="realization"
                        fill="#6366f1"
                        name="Terlayani"
                      />
                      <Bar
                        dataKey="unserved"
                        fill="#fca5a5"
                        name="Belum Terlayani"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    Tidak ada data
                  </p>
                )}
              </div>

              {/* Puskesmas Chart */}
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Capaian per Puskesmas (%)
                </h3>
                {puskesmasChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={puskesmasChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={120}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip formatter={(value) => `${value}%`} />
                      <Bar
                        dataKey="percentage"
                        fill="#10b981"
                        name="Persentase"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    Tidak ada data
                  </p>
                )}
              </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-xl shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800">
                  Detail Capaian - {selectedPeriod}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Puskesmas
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Indikator
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Sasaran
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Terlayani
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Belum
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        %
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredData.slice(0, 20).map((row) => {
                      const puskesmasName =
                        puskesmasList.find((p) => p.code === row.puskesmas_code)
                          ?.name || row.puskesmas_code;
                      const pct = calculatePercentage(
                        row.target_qty,
                        row.realization_qty,
                      );
                      return (
                        <tr key={row.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-800">
                            {puskesmasName}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {row.indicator_name}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-800">
                            {Number(row.target_qty || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">
                            {Number(row.realization_qty || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-red-600">
                            {Number(row.unserved_qty || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                pct >= 80
                                  ? "bg-green-100 text-green-700"
                                  : pct >= 50
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-red-100 text-red-700"
                              }`}
                            >
                              {pct}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredData.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    Belum ada data untuk periode ini. Sync dari Google Sheets di
                    halaman Kelola Data.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
