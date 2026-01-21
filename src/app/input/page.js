"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const PUSKESMAS_LIST = [
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

export default function InputDataPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState(null); // { indicator, puskesmas }
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setError(null);
      const { data: result, error } = await supabase
        .from("achievements")
        .select("*")
        .order("puskesmas_code", { ascending: true });

      if (error) throw error;
      setData(result);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Gagal memuat data. Silakan refresh halaman.");
    } finally {
      setLoading(false);
    }
  }

  // Get unique indicators
  const indicators = useMemo(() => {
    return [...new Set(data.map((d) => d.indicator_name))];
  }, [data]);

  // Helper to find cell data
  const getCellData = useCallback(
    (indicatorName, pkmCode) => {
      return data.find(
        (d) =>
          d.indicator_name === indicatorName && d.puskesmas_code === pkmCode,
      );
    },
    [data],
  );

  const handleCellClick = (indicatorName, pkmCode) => {
    const cellData = getCellData(indicatorName, pkmCode);
    if (!cellData) return;
    setEditingCell({ indicator: indicatorName, puskesmas: pkmCode });
    setEditValue(cellData.realization_qty.toString());
  };

  const handleKeyDown = (e, indicatorName, pkmCode) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave(indicatorName, pkmCode);
    } else if (e.key === "Escape") {
      setEditingCell(null);
      setEditValue("");
    } else if (e.key === "Tab") {
      e.preventDefault();
      handleSave(indicatorName, pkmCode);
      // Move to next cell
      const currentPkmIdx = PUSKESMAS_LIST.indexOf(pkmCode);
      const currentIndIdx = indicators.indexOf(indicatorName);
      if (currentPkmIdx < PUSKESMAS_LIST.length - 1) {
        const nextPkm = PUSKESMAS_LIST[currentPkmIdx + 1];
        handleCellClick(indicatorName, nextPkm);
      } else if (currentIndIdx < indicators.length - 1) {
        const nextInd = indicators[currentIndIdx + 1];
        handleCellClick(nextInd, PUSKESMAS_LIST[0]);
      }
    }
  };

  const handleSave = useCallback(
    async (indicatorName, pkmCode) => {
      if (saving) return;

      const cellData = getCellData(indicatorName, pkmCode);
      if (!cellData) return;

      const newValue = Math.round(Number(editValue));
      if (isNaN(newValue) || newValue < 0) {
        setError("Nilai harus berupa angka positif");
        setEditingCell(null);
        return;
      }

      // No change, just close
      if (newValue === cellData.realization_qty) {
        setEditingCell(null);
        return;
      }

      setEditingCell(null);
      setSaving(true);
      setError(null);

      // Optimistic Update
      const updatedData = data.map((d) =>
        d.id === cellData.id
          ? {
              ...d,
              realization_qty: newValue,
              unserved_qty: Math.max(0, d.target_qty - newValue),
            }
          : d,
      );
      setData(updatedData);

      try {
        // Sync to Google Sheets (jika URL tersedia)
        const scriptUrl = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL;
        const syncToken = process.env.NEXT_PUBLIC_SYNC_TOKEN;

        if (scriptUrl) {
          await fetch(scriptUrl, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: syncToken || "",
              puskesmas_code: cellData.puskesmas_code,
              indicator_name: cellData.indicator_name,
              type: "realization_qty",
              value: newValue,
            }),
          });
        } else {
          console.warn(
            "⚠️ NEXT_PUBLIC_GOOGLE_SCRIPT_URL belum diset, skip sync ke Google Sheets",
          );
        }

        // Sync to Supabase
        const { error: updateError } = await supabase
          .from("achievements")
          .update({
            realization_qty: newValue,
            unserved_qty: Math.max(0, cellData.target_qty - newValue),
          })
          .eq("id", cellData.id);

        if (updateError) throw updateError;
      } catch (err) {
        console.error("Save error:", err);
        setError("Gagal menyimpan: " + (err.message || "Terjadi kesalahan"));
        fetchData();
      } finally {
        setSaving(false);
      }
    },
    [data, editValue, saving, getCellData],
  );

  // Loading Skeleton
  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-full mx-auto">
          <div className="animate-pulse">
            <div className="h-7 bg-gray-200 rounded w-48 mb-6"></div>
            <div className="bg-white rounded border border-gray-200">
              <div className="h-10 bg-gray-100 border-b border-gray-200"></div>
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-10 border-b border-gray-100 flex">
                  <div className="w-48 bg-gray-50 p-2">
                    <div className="h-4 bg-gray-200 rounded w-32"></div>
                  </div>
                  {[...Array(15)].map((_, j) => (
                    <div key={j} className="w-16 p-2">
                      <div className="h-4 bg-gray-100 rounded"></div>
                    </div>
                  ))}
                </div>
              ))}
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
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-gray-800">
            Input / Edit Data Realisasi
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Klik sel untuk mengedit. Tekan{" "}
            <kbd className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded text-xs font-mono">
              Enter
            </kbd>{" "}
            untuk simpan,{" "}
            <kbd className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded text-xs font-mono">
              Tab
            </kbd>{" "}
            untuk pindah ke sel berikutnya,{" "}
            <kbd className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded text-xs font-mono">
              Esc
            </kbd>{" "}
            untuk batal.
          </p>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700 font-medium ml-4"
            >
              Tutup
            </button>
          </div>
        )}

        {saving && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded text-sm flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Menyimpan...</span>
          </div>
        )}

        {/* Matrix Table */}
        <div className="bg-white rounded border border-gray-300 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="border border-slate-600 p-2 text-left font-semibold sticky left-0 bg-slate-800 z-20 min-w-[220px]">
                    Indikator
                  </th>
                  {PUSKESMAS_LIST.map((pkm) => (
                    <th
                      key={pkm}
                      className={`border border-slate-600 p-2 text-center font-semibold min-w-[65px] ${
                        pkm === "KAB" ? "bg-amber-600" : ""
                      }`}
                    >
                      {pkm}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {indicators.map((ind, idx) => (
                  <tr
                    key={ind}
                    className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="border border-gray-300 p-2 text-gray-800 font-medium sticky left-0 bg-inherit z-10">
                      {ind}
                    </td>
                    {PUSKESMAS_LIST.map((pkm) => {
                      const cellData = getCellData(ind, pkm);
                      const value = cellData?.realization_qty ?? "-";
                      const isKab = pkm === "KAB";
                      const isEditing =
                        editingCell?.indicator === ind &&
                        editingCell?.puskesmas === pkm;

                      return (
                        <td
                          key={pkm}
                          className={`border border-gray-300 p-0 text-center ${
                            isKab
                              ? "bg-amber-50"
                              : "cursor-pointer hover:bg-blue-50"
                          } ${isEditing ? "bg-blue-100" : ""}`}
                          onClick={() => !isKab && handleCellClick(ind, pkm)}
                        >
                          {isEditing ? (
                            <input
                              type="number"
                              className="w-full h-full p-2 text-center border-2 border-blue-500 outline-none bg-white font-medium text-blue-700 tabular-nums"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, ind, pkm)}
                              onBlur={() => handleSave(ind, pkm)}
                              autoFocus
                              min="0"
                            />
                          ) : (
                            <div
                              className={`p-2 tabular-nums ${
                                isKab
                                  ? "font-semibold text-amber-800"
                                  : "text-gray-700"
                              }`}
                            >
                              {typeof value === "number"
                                ? value.toLocaleString("id-ID")
                                : value}
                            </div>
                          )}
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
        <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
          <span>
            {indicators.length} indikator x {PUSKESMAS_LIST.length} puskesmas ={" "}
            {data.length} sel data
          </span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-amber-50 border border-amber-300 rounded-sm"></span>
              <span>= Data Kabupaten (Agregat / Read-Only)</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
