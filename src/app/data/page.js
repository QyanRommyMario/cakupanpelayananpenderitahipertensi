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
  const [selectedPuskesmas, setSelectedPuskesmas] = useState("");
  const [periods, setPeriods] = useState([]);

  // KEAMANAN: State untuk role dan puskesmas user
  const [isAdmin, setIsAdmin] = useState(false);
  const [userPuskesmasCode, setUserPuskesmasCode] = useState(null);

  // Helper: Check if user is admin based on email
  const checkIsAdmin = (email) => {
    const adminEmails = [
      "kab@dinkes.go.id",
      "admin@dinkes.go.id",
      "admin@example.com",
    ];
    return adminEmails.includes(email?.toLowerCase());
  };

  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
    } else {
      setUser(session.user);

      // KEAMANAN: Set role dan puskesmas code berdasarkan email
      const adminStatus = checkIsAdmin(session.user.email);
      setIsAdmin(adminStatus);

      if (!adminStatus) {
        const emailCode = session.user.email.split("@")[0].toUpperCase();
        setUserPuskesmasCode(emailCode);
        setSelectedPuskesmas(emailCode); // Auto-select puskesmas untuk non-admin
      }

      loadData(adminStatus, session.user.email);
    }
  };

  const loadData = async (adminStatus = isAdmin, userEmail = user?.email) => {
    setLoading(true);
    const { data: puskesmasData } = await supabase
      .from("puskesmas")
      .select("*")
      .order("name");
    setPuskesmasList(puskesmasData || []);

    // KEAMANAN: Build query dengan filter berdasarkan role
    let query = supabase
      .from("achievements")
      .select("*")
      .order("period", { ascending: false })
      .order("puskesmas_code", { ascending: true });

    // Jika bukan admin, filter ke puskesmas sendiri
    if (!adminStatus && userEmail) {
      const emailCode = userEmail.split("@")[0].toUpperCase();
      query = query.eq("puskesmas_code", emailCode);
    }

    const { data: achievementsData } = await query;

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

  const filteredData = data.filter((d) => {
    const periodMatch = !selectedPeriod || d.period === selectedPeriod;
    const puskesmasMatch =
      !selectedPuskesmas || d.puskesmas_code === selectedPuskesmas;
    return periodMatch && puskesmasMatch;
  });

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 5000);
  };

  const startEdit = (row) => {
    // KEAMANAN: Non-admin hanya bisa edit data puskesmas sendiri
    if (
      !isAdmin &&
      userPuskesmasCode &&
      row.puskesmas_code !== userPuskesmasCode
    ) {
      showMessage(
        "error",
        "Anda hanya dapat mengedit data Puskesmas Anda sendiri!",
      );
      return;
    }
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
    // KEAMANAN: Verifikasi kepemilikan data sebelum update
    const rowToEdit = data.find((d) => d.id === id);
    if (
      !isAdmin &&
      userPuskesmasCode &&
      rowToEdit?.puskesmas_code !== userPuskesmasCode
    ) {
      showMessage("error", "Anda tidak memiliki izin untuk mengedit data ini!");
      return;
    }

    setSaving(true);
    const target_qty = parseFloat(editForm.target_qty) || 0;
    const realization_qty = parseFloat(editForm.realization_qty) || 0;
    const unserved_qty = parseFloat(editForm.unserved_qty) || 0;

    // KEAMANAN: Tambahkan filter puskesmas_code untuk non-admin
    let updateQuery = supabase
      .from("achievements")
      .update({
        target_qty,
        realization_qty,
        unserved_qty,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (!isAdmin && userPuskesmasCode) {
      updateQuery = updateQuery.eq("puskesmas_code", userPuskesmasCode);
    }

    const { error } = await updateQuery;

    if (error) {
      showMessage("error", "Gagal menyimpan: " + error.message);
    } else {
      showMessage("success", "Data berhasil disimpan");
      setEditingId(null);
      setEditForm({});
      loadData(isAdmin, user?.email);
    }
    setSaving(false);
  };

  const deleteRow = async (id) => {
    // KEAMANAN: Verifikasi kepemilikan data sebelum delete
    const rowToDelete = data.find((d) => d.id === id);
    if (
      !isAdmin &&
      userPuskesmasCode &&
      rowToDelete?.puskesmas_code !== userPuskesmasCode
    ) {
      showMessage(
        "error",
        "Anda tidak memiliki izin untuk menghapus data ini!",
      );
      return;
    }

    if (!confirm("Yakin ingin menghapus data ini?")) return;

    // KEAMANAN: Tambahkan filter puskesmas_code untuk non-admin
    let deleteQuery = supabase.from("achievements").delete().eq("id", id);

    if (!isAdmin && userPuskesmasCode) {
      deleteQuery = deleteQuery.eq("puskesmas_code", userPuskesmasCode);
    }

    const { error } = await deleteQuery;

    if (error) {
      showMessage("error", "Gagal menghapus: " + error.message);
    } else {
      showMessage("success", "Data berhasil dihapus");
      loadData(isAdmin, user?.email);
    }
  };

  const deletePeriod = async () => {
    if (!selectedPeriod) return;
    if (!confirm(`Yakin ingin menghapus SEMUA data periode ${selectedPeriod}?`))
      return;

    // KEAMANAN: Tambahkan filter puskesmas untuk non-admin agar hanya hapus data sendiri
    let deleteQuery = supabase
      .from("achievements")
      .delete()
      .eq("period", selectedPeriod);

    if (!isAdmin && userPuskesmasCode) {
      deleteQuery = deleteQuery.eq("puskesmas_code", userPuskesmasCode);
    }

    const { error } = await deleteQuery;

    if (error) {
      showMessage("error", "Gagal menghapus: " + error.message);
    } else {
      showMessage("success", `Data periode ${selectedPeriod} berhasil dihapus`);
      setSelectedPeriod("");
      loadData(isAdmin, user?.email);
    }
  };

  const calculatePercentage = (target, realization) => {
    if (!target || target === 0) return 0;
    return Math.round((realization / target) * 100);
  };

  return (
    <DashboardLayout>
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Kelola Data</h1>
              <p className="text-gray-500 mt-1">
                Data akan di-sync dari Google Sheets via Apps Script
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white text-sm"
              >
                <option value="">Semua Periode</option>
                {periods.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <select
                value={selectedPuskesmas}
                onChange={(e) => setSelectedPuskesmas(e.target.value)}
                disabled={!isAdmin}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                {isAdmin && <option value="">Semua Puskesmas</option>}
                {puskesmasList.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.code} - {p.name}
                  </option>
                ))}
              </select>
              {!isAdmin && (
                <span className="text-xs text-gray-500 ml-2">
                  * Hanya data puskesmas sendiri
                </span>
              )}
              {selectedPeriod && (
                <button
                  onClick={deletePeriod}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  Hapus Periode
                </button>
              )}
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <h3 className="font-semibold text-emerald-800 mb-2 flex items-center gap-2">
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
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Cara Sync Data
            </h3>
            <ol className="text-sm text-emerald-700 space-y-1 list-decimal list-inside">
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
              className={`p-4 rounded-xl flex items-center gap-3 ${
                message.type === "success"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-rose-50 text-rose-700 border border-rose-200"
              }`}
            >
              {message.type === "success" ? (
                <svg
                  className="w-5 h-5 flex-shrink-0"
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
              ) : (
                <svg
                  className="w-5 h-5 flex-shrink-0"
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
              {message.text}
            </div>
          )}

          {/* Summary */}
          {filteredData.length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-slate-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">
                    Total Records
                  </p>
                  <p className="text-lg font-bold text-gray-800">
                    {filteredData.length}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-slate-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">
                    Total Sasaran
                  </p>
                  <p className="text-lg font-bold text-gray-800">
                    {filteredData
                      .reduce((a, b) => a + (Number(b.target_qty) || 0), 0)
                      .toLocaleString("id-ID")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-emerald-600"
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
                <div>
                  <p className="text-xs text-gray-500 uppercase">
                    Total Terlayani
                  </p>
                  <p className="text-lg font-bold text-emerald-600">
                    {filteredData
                      .reduce((a, b) => a + (Number(b.realization_qty) || 0), 0)
                      .toLocaleString("id-ID")}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                        Periode
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                        Puskesmas
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                        Indikator
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                        Sasaran
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                        Terlayani
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                        Belum
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                        Capaian
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
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
                          <td className="px-4 py-3 text-sm text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                                pct >= 100
                                  ? "bg-emerald-100 text-emerald-700"
                                  : pct >= 75
                                    ? "bg-blue-100 text-blue-700"
                                    : pct >= 50
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-rose-100 text-rose-700"
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
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
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
                                  className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
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
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
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
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
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
                  <div className="text-center py-16 text-gray-500">
                    <svg
                      className="w-16 h-16 mx-auto mb-4 text-gray-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <p className="text-lg font-medium">Belum ada data</p>
                    <p className="mt-1 text-sm">
                      Sync data dari Google Sheets menggunakan Apps Script
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-gray-400">
            Data diperbarui secara realtime dari Google Sheets dan Supabase
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
