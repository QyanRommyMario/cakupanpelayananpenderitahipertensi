"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";

export default function DataPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [data, setData] = useState([]);
  const [puskesmasList, setPuskesmasList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [message, setMessage] = useState({ type: "", text: "" });
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [periods, setPeriods] = useState([]);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
    } else {
      setUser(session.user);
      loadData();
    }
  };

  const loadData = async () => {
    setLoading(true);
    const { data: puskesmasData } = await supabase
      .from("puskesmas")
      .select("*")
      .order("name");
    setPuskesmasList(puskesmasData || []);

    const { data: achievementsData } = await supabase
      .from("achievements")
      .select("*")
      .order("period", { ascending: false })
      .order("puskesmas_code", { ascending: true });

    if (achievementsData) {
      setData(achievementsData);
      const uniquePeriods = [...new Set(achievementsData.map((d) => d.period))]
        .sort()
        .reverse();
      setPeriods(uniquePeriods);
      if (uniquePeriods.length > 0 && !selectedPeriod) {
        setSelectedPeriod(uniquePeriods[0]);
      }
    }
    setLoading(false);
  };

  const filteredData = selectedPeriod
    ? data.filter((d) => d.period === selectedPeriod)
    : data;

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 5000);
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    setEditForm({
      target_qty: row.target_qty,
      realization_qty: row.realization_qty,
      unserved_qty: row.unserved_qty,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async (id) => {
    setSaving(true);
    const target_qty = parseFloat(editForm.target_qty) || 0;
    const realization_qty = parseFloat(editForm.realization_qty) || 0;
    const unserved_qty = parseFloat(editForm.unserved_qty) || 0;

    const { error } = await supabase
      .from("achievements")
      .update({
        target_qty,
        realization_qty,
        unserved_qty,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      showMessage("error", "Gagal menyimpan: " + error.message);
    } else {
      showMessage("success", "Data berhasil disimpan");
      setEditingId(null);
      setEditForm({});
      loadData();
    }
    setSaving(false);
  };

  const deleteRow = async (id) => {
    if (!confirm("Yakin ingin menghapus data ini?")) return;

    const { error } = await supabase.from("achievements").delete().eq("id", id);

    if (error) {
      showMessage("error", "Gagal menghapus: " + error.message);
    } else {
      showMessage("success", "Data berhasil dihapus");
      loadData();
    }
  };

  const deletePeriod = async () => {
    if (!selectedPeriod) return;
    if (!confirm(`Yakin ingin menghapus SEMUA data periode ${selectedPeriod}?`))
      return;

    const { error } = await supabase
      .from("achievements")
      .delete()
      .eq("period", selectedPeriod);

    if (error) {
      showMessage("error", "Gagal menghapus: " + error.message);
    } else {
      showMessage("success", `Data periode ${selectedPeriod} berhasil dihapus`);
      setSelectedPeriod("");
      loadData();
    }
  };

  const calculatePercentage = (target, realization) => {
    if (!target || target === 0) return 0;
    return Math.round((realization / target) * 100);
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Kelola Data</h1>
            <p className="text-gray-500">
              Data akan di-sync dari Google Sheets via Apps Script
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="">Semua Periode</option>
              {periods.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            {selectedPeriod && (
              <button
                onClick={deletePeriod}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
              >
                Hapus Periode
              </button>
            )}
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 mb-2">
            📊 Cara Sync Data
          </h3>
          <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            <li>Buka Google Sheets dengan data Pivot Table</li>
            <li>
              Buka menu <strong>📊 SPM Dashboard</strong> di toolbar
            </li>
            <li>
              Klik <strong>🔄 Sync Data to Dashboard</strong>
            </li>
            <li>Data akan otomatis masuk ke dashboard ini</li>
          </ol>
        </div>

        {/* Message */}
        {message.text && (
          <div
            className={`p-4 rounded-lg ${
              message.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Summary */}
        {filteredData.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4 flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-gray-500">Total Records:</span>{" "}
              <span className="font-semibold">{filteredData.length}</span>
            </div>
            <div>
              <span className="text-gray-500">Total Sasaran:</span>{" "}
              <span className="font-semibold">
                {filteredData
                  .reduce((a, b) => a + (Number(b.target_qty) || 0), 0)
                  .toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Total Terlayani:</span>{" "}
              <span className="font-semibold text-green-600">
                {filteredData
                  .reduce((a, b) => a + (Number(b.realization_qty) || 0), 0)
                  .toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Periode
                    </th>
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
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredData.map((row) => {
                    const puskesmasName =
                      puskesmasList.find((p) => p.code === row.puskesmas_code)
                        ?.name || row.puskesmas_code;
                    const isEditing = editingId === row.id;
                    const pct = calculatePercentage(
                      row.target_qty,
                      row.realization_qty,
                    );

                    return (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {row.period}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800">
                          {puskesmasName}
                        </td>
                        <td
                          className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate"
                          title={row.indicator_name}
                        >
                          {row.indicator_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editForm.target_qty}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  target_qty: e.target.value,
                                })
                              }
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-right text-sm"
                            />
                          ) : (
                            Number(row.target_qty || 0).toLocaleString()
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editForm.realization_qty}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  realization_qty: e.target.value,
                                })
                              }
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-right text-sm"
                            />
                          ) : (
                            <span className="text-green-600 font-medium">
                              {Number(
                                row.realization_qty || 0,
                              ).toLocaleString()}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editForm.unserved_qty}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  unserved_qty: e.target.value,
                                })
                              }
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-right text-sm"
                            />
                          ) : (
                            <span className="text-red-600">
                              {Number(row.unserved_qty || 0).toLocaleString()}
                            </span>
                          )}
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
                        <td className="px-4 py-3 text-sm text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center space-x-1">
                              <button
                                onClick={() => saveEdit(row.id)}
                                disabled={saving}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                title="Simpan"
                              >
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
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                                title="Batal"
                              >
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
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center space-x-1">
                              <button
                                onClick={() => startEdit(row)}
                                className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                                title="Edit"
                              >
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
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                              </button>
                              <button
                                onClick={() => deleteRow(row.id)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Hapus"
                              >
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
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredData.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <svg
                    className="w-16 h-16 mx-auto mb-4 text-gray-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="text-lg font-medium">Belum ada data</p>
                  <p className="mt-1">
                    Sync data dari Google Sheets menggunakan Apps Script
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
