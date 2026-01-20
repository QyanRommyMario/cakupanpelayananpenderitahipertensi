"use client";
import { useState, useEffect } from "react";
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

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/XXXXX/exec";
const SYNC_TOKEN = "spm-dashboard-sync-token-2025";

export default function DashboardPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const { data: result, error } = await supabase
        .from("achievements")
        .select("*")
        // Sembunyikan 'KAB' dari list tabel jika mau, atau biarkan tampil
        // .neq('puskesmas_code', 'KAB')
        .order("puskesmas_code", { ascending: true });

      if (error) throw error;
      setData(result);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleEditClick = (item) => {
    setEditingId(item.id);
    setEditValue(item.realization_qty);
  };

  const handleSave = async (item) => {
    const newValue = Math.round(Number(editValue));

    // Optimistic Update
    const updatedData = data.map((d) =>
      d.id === item.id ? { ...d, realization_qty: newValue } : d,
    );
    setData(updatedData);
    setEditingId(null);

    try {
      // Sync to Excel
      await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: SYNC_TOKEN,
          puskesmas_code: item.puskesmas_code,
          indicator_name: item.indicator_name,
          type: "realization_qty",
          value: newValue,
        }),
      });

      // Sync to Supabase
      await supabase
        .from("achievements")
        .update({
          realization_qty: newValue,
          unserved_qty: Math.max(0, item.target_qty - newValue),
        })
        .eq("id", item.id);

      alert("Tersimpan!");
    } catch (err) {
      alert("Gagal: " + err.message);
      fetchData();
    }
  };

  // Group Data for Chart (Exclude KAB for cleaner chart usually, or keep it)
  const chartData = Object.values(
    data
      .filter((d) => d.puskesmas_code !== "KAB") // Filter KAB agar grafik tidak timpang
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
      }, {}),
  );

  if (loading) return <div className="p-10 text-center">Loading Data...</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">
        Dashboard SPM Hipertensi
      </h1>

      {/* CHART */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-lg font-semibold mb-4">
          Grafik Kinerja PKM (Tanpa Kabupaten)
        </h2>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip
                formatter={(val) => new Intl.NumberFormat("id-ID").format(val)}
              />
              <Legend />
              <Bar
                dataKey="Target"
                fill="#94a3b8"
                name="Sasaran"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="Realisasi"
                fill="#3b82f6"
                name="Realisasi"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white p-6 rounded-lg shadow-md overflow-x-auto">
        <h2 className="text-lg font-semibold mb-4">
          Detail Data Lengkap (Termasuk KAB)
        </h2>
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="p-3">Kode</th>
              <th className="p-3">Indikator</th>
              <th className="p-3">Satuan</th>
              <th className="p-3 text-right">Sasaran</th>
              <th className="p-3 text-right">Realisasi</th>
              <th className="p-3 text-right">Belum</th>
              <th className="p-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={row.id}
                className={`border-b hover:bg-gray-50 ${row.puskesmas_code === "KAB" ? "bg-yellow-50 font-semibold" : ""}`}
              >
                <td className="p-3 font-bold">{row.puskesmas_code}</td>
                <td className="p-3">{row.indicator_name}</td>
                <td className="p-3 text-gray-500">{row.unit}</td>
                <td className="p-3 text-right">
                  {row.target_qty.toLocaleString("id-ID")}
                </td>

                <td className="p-3 text-right">
                  {editingId === row.id ? (
                    <input
                      type="number"
                      className="border p-1 w-20 text-right"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                    />
                  ) : (
                    <span className="font-semibold text-blue-600">
                      {row.realization_qty.toLocaleString("id-ID")}
                    </span>
                  )}
                </td>

                <td className="p-3 text-right text-red-500">
                  {row.unserved_qty > 0
                    ? row.unserved_qty.toLocaleString("id-ID")
                    : "-"}
                </td>

                <td className="p-3 text-center">
                  {editingId === row.id ? (
                    <button
                      onClick={() => handleSave(row)}
                      className="bg-green-500 text-white px-3 py-1 rounded text-xs"
                    >
                      Simpan
                    </button>
                  ) : (
                    <button
                      onClick={() => handleEditClick(row)}
                      className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-xs hover:bg-gray-300"
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
