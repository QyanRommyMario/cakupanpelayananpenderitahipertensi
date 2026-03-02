"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";
import { calculateMetrics } from "@/lib/dataHelpers";
import logger from "@/lib/logger";
import {
  generateTriwulanOptions,
  getCurrentPeriod,
  formatPeriodLabel,
} from "@/utils/periods";
import {
  PROGRAM_TYPES,
  PROGRAM_TYPES_LIST,
  isValidProgramType,
  getProgramLabel,
  getIndicatorsForProgram,
  getProgram,
} from "@/utils/constants";

export default function InputDataPage() {
  const router = useRouter();

  // Loading states
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);

  // Messages
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
  });

  // User info
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Dropdown options
  const [puskesmasList, setPuskesmasList] = useState([]);
  const [indicators, setIndicators] = useState([]);
  const periodOptions = useMemo(
    () => generateTriwulanOptions().filter((p) => p.type === "month"),
    [],
  );

  // Selected values
  const [selectedPuskesmas, setSelectedPuskesmas] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [selectedProgramType, setSelectedProgramType] = useState(""); // BARU: Program Type

  // Form data - keyed by indicator_name
  const [formData, setFormData] = useState({});

  // Mode indicator
  const [isEditMode, setIsEditMode] = useState(false);

  // Validation state untuk Program Type
  const [programTypeError, setProgramTypeError] = useState(false);

  // State untuk propagasi target Januari
  const [propagating, setPropagating] = useState(false);
  const [isTargetAutoFilled, setIsTargetAutoFilled] = useState(false);

  // Show toast notification
  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(
      () => setToast({ show: false, message: "", type: "success" }),
      3000,
    );
  };

  // Helper: Check if period is January
  const isJanuaryPeriod = (period) => {
    return period && period.endsWith("-01");
  };

  // Helper: Get next period (e.g., 2026-01 -> 2026-02)
  const getNextPeriod = (period) => {
    const [year, month] = period.split("-");
    const m = parseInt(month);
    if (m >= 12) return null; // No next month in this year
    return `${year}-${String(m + 1).padStart(2, "0")}`;
  };

  // Propagate targets to the next month only (carry-over)
  const propagateTargetToNextMonth = async (
    puskesmasCode,
    programType,
    currentRecords,
  ) => {
    const nextPeriod = getNextPeriod(selectedPeriod);
    if (!nextPeriod) return null; // December, no next month

    // Check if next month already has data
    const { data: nextData, error: fetchError } = await supabase
      .from("achievements")
      .select("indicator_name, realization_qty")
      .eq("puskesmas_code", puskesmasCode)
      .eq("program_type", programType)
      .eq("period", nextPeriod);

    if (fetchError) return fetchError;

    // Build lookup for existing realization in next month
    const existingMap = {};
    (nextData || []).forEach((e) => {
      existingMap[e.indicator_name] = e.realization_qty || 0;
    });

    // Build records for next month: carry over targets AND realization
    // If next month already has data, preserve it; otherwise carry over current month's values
    const nextRecords = currentRecords.map((rec) => ({
      puskesmas_code: puskesmasCode,
      indicator_name: rec.indicator_name,
      period: nextPeriod,
      program_type: programType,
      target_qty: rec.target_qty,
      realization_qty: existingMap[rec.indicator_name] || rec.realization_qty || 0,
      unit: rec.unit,
    }));

    // Upsert next month
    const { error: upsertError } = await supabase
      .from("achievements")
      .upsert(nextRecords, {
        onConflict:
          "puskesmas_code,indicator_name,period,program_type",
      });

    return upsertError;
  };

  // Check if user is admin
  // Check admin status from Supabase user_metadata
  // Set di Supabase Dashboard: Authentication > Users > Edit > user_metadata: {"is_admin": true}
  const checkIsAdmin = (user) => {
    return user?.user_metadata?.is_admin === true;
  };

  // Initialize user session and load options
  useEffect(() => {
    async function initPage() {
      try {
        setLoading(true);

        // Get current user session
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!session) {
          router.push("/login");
          return;
        }

        setCurrentUser(session.user);
        const adminStatus = checkIsAdmin(session.user);
        setIsAdmin(adminStatus);

        // Fetch puskesmas list (exclude KAB for input)
        const { data: pkmData, error: pkmError } = await supabase
          .from("puskesmas")
          .select("*")
          .neq("code", "KAB")
          .order("name");

        if (pkmError) throw pkmError;
        setPuskesmasList(pkmData || []);

        // Set default period
        setSelectedPeriod(getCurrentPeriod());

        // For non-admin, auto-select their puskesmas
        if (!adminStatus) {
          const emailCode = session.user.email.split("@")[0].toUpperCase();
          const userPkm = (pkmData || []).find((p) => p.code === emailCode);
          if (userPkm) {
            setSelectedPuskesmas(userPkm.code);
          } else {
            setError("Puskesmas tidak ditemukan untuk akun ini");
          }
        }
      } catch (err) {
        logger.error("Init error", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    initPage();
  }, [router]);

  // Update indicators when programType changes
  useEffect(() => {
    if (!selectedProgramType || !isValidProgramType(selectedProgramType)) {
      setIndicators([]);
      setFormData({});
      return;
    }

    // Get indicators from centralized config
    const programConfig = getIndicatorsForProgram(selectedProgramType);
    const sortedIndicators = programConfig.order.map((name) => ({
      indicator_name: name,
      unit: name === "JUMLAH YANG HARUS DILAYANI" ? "Orang" : "Paket",
    }));

    setIndicators(sortedIndicators);

    // Initialize empty form
    const initialData = {};
    sortedIndicators.forEach((ind) => {
      initialData[ind.indicator_name] = {
        target: 0,
        realization: 0,
        unit: ind.unit,
      };
    });
    setFormData(initialData);
    setIsEditMode(false);
  }, [selectedProgramType]);

  // Load existing data when puskesmas, period, or programType changes
  useEffect(() => {
    async function loadExistingData() {
      if (
        !selectedPuskesmas ||
        !selectedPeriod ||
        !selectedProgramType ||
        indicators.length === 0
      )
        return;

      // KEAMANAN: Validasi programType sebelum query
      if (!isValidProgramType(selectedProgramType)) {
        setError(`Program type tidak valid: ${selectedProgramType}`);
        return;
      }

      try {
        setLoadingData(true);

        const { data: achievements, error: achError } = await supabase
          .from("achievements")
          .select("*")
          .eq("puskesmas_code", selectedPuskesmas)
          .eq("period", selectedPeriod)
          .eq("program_type", selectedProgramType); // FILTER BY PROGRAM TYPE

        if (achError) throw achError;

        // Check if we have existing data
        const hasData = achievements && achievements.length > 0;
        setIsEditMode(hasData);

        if (hasData) {
          // Update form data with existing data
          const updatedData = {};
          indicators.forEach((ind) => {
            const existing = achievements?.find(
              (a) => a.indicator_name === ind.indicator_name,
            );
            updatedData[ind.indicator_name] = {
              target: existing?.target_qty || 0,
              realization: existing?.realization_qty || 0,
              unit: existing?.unit || ind.unit || "Orang",
            };
          });
          setFormData(updatedData);
          setIsTargetAutoFilled(false);
        } else {
          // No data for this month: try to auto-fill targets from the most recent previous month
          const year = selectedPeriod.split("-")[0];
          const currentMonth = parseInt(selectedPeriod.split("-")[1]);

          // Build list of all prior months in the same year (most recent first)
          const priorPeriods = [];
          for (let m = currentMonth - 1; m >= 1; m--) {
            priorPeriods.push(`${year}-${String(m).padStart(2, "0")}`);
          }

          let autoFilled = false;
          let sourcePeriodLabel = "";

          if (priorPeriods.length > 0) {
            // Fetch all data from prior months to find the most recent one
            const { data: priorData } = await supabase
              .from("achievements")
              .select("*")
              .eq("puskesmas_code", selectedPuskesmas)
              .eq("program_type", selectedProgramType)
              .in("period", priorPeriods)
              .order("period", { ascending: false });

            if (priorData && priorData.length > 0) {
              // Get the most recent period that has data
              const latestPeriod = priorData[0].period;
              const latestData = priorData.filter((d) => d.period === latestPeriod);

              // Format source month label
              const srcMonth = parseInt(latestPeriod.split("-")[1]);
              const monthNames = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
              sourcePeriodLabel = monthNames[srcMonth] || latestPeriod;

              const updatedData = {};
              indicators.forEach((ind) => {
                const prevRecord = latestData.find(
                  (a) => a.indicator_name === ind.indicator_name,
                );
                updatedData[ind.indicator_name] = {
                  target: prevRecord?.target_qty || 0,
                  realization: prevRecord?.realization_qty || 0,
                  unit: prevRecord?.unit || ind.unit || "Orang",
                };
              });
              setFormData(updatedData);
              setIsTargetAutoFilled(true);
              autoFilled = true;
              showToast(
                `Target & Realisasi otomatis diisi dari data ${sourcePeriodLabel}. Silakan sesuaikan sesuai kebutuhan.`,
                "success",
              );
            }
          }

          if (!autoFilled) {
            // No prior data found, initialize empty
            const updatedData = {};
            indicators.forEach((ind) => {
              updatedData[ind.indicator_name] = {
                target: 0,
                realization: 0,
                unit: ind.unit || "Orang",
              };
            });
            setFormData(updatedData);
            setIsTargetAutoFilled(false);
          }
        }
      } catch (err) {
        logger.error("Load data error", err);
        setError("Gagal memuat data: " + err.message);
      } finally {
        setLoadingData(false);
      }
    }

    loadExistingData();
  }, [selectedPuskesmas, selectedPeriod, selectedProgramType, indicators]);

  // Handle input change
  const handleInputChange = useCallback((indicatorName, field, value) => {
    const numValue = parseInt(value) || 0;
    setFormData((prev) => ({
      ...prev,
      [indicatorName]: {
        ...prev[indicatorName],
        [field]: numValue,
      },
    }));
  }, []);

  // Handle save (Upsert)
  const handleSave = async () => {
    // VALIDASI: Cek Program Type terlebih dahulu
    if (!selectedProgramType) {
      setProgramTypeError(true);
      showToast("Harap pilih Jenis Layanan terlebih dahulu!", "error");
      return;
    }

    // KEAMANAN: Validasi ulang programType
    if (!isValidProgramType(selectedProgramType)) {
      showToast(
        `Program type tidak valid: ${selectedProgramType}. Gunakan dropdown yang tersedia.`,
        "error",
      );
      return;
    }

    if (!selectedPuskesmas || !selectedPeriod) {
      showToast("Pilih Puskesmas dan Periode terlebih dahulu", "error");
      return;
    }

    // KEAMANAN: Validasi puskesmas untuk non-admin
    // Non-admin hanya boleh input data untuk puskesmas sendiri
    let targetPuskesmasCode = selectedPuskesmas;
    if (!isAdmin && currentUser) {
      const userPuskesmasCode = currentUser.email.split("@")[0].toUpperCase();
      if (selectedPuskesmas !== userPuskesmasCode) {
        showToast(
          "Anda hanya dapat menginput data untuk Puskesmas Anda sendiri!",
          "error",
        );
        return;
      }
      targetPuskesmasCode = userPuskesmasCode; // Force use user's own puskesmas
    }

    setProgramTypeError(false);
    setSaving(true);
    setError(null);

    try {
      // Prepare upsert data dengan program_type
      const records = indicators.map((ind) => {
        const data = formData[ind.indicator_name] || {
          target: 0,
          realization: 0,
        };
        return {
          puskesmas_code: targetPuskesmasCode, // KEAMANAN: Gunakan validated code
          indicator_name: ind.indicator_name,
          period: selectedPeriod,
          program_type: selectedProgramType, // WAJIB: Program Type
          target_qty: data.target,
          realization_qty: data.realization,
          unit: data.unit || ind.unit || "Orang",
        };
      });

      const { error: upsertError } = await supabase
        .from("achievements")
        .upsert(records, {
          onConflict: "puskesmas_code,indicator_name,period,program_type",
        });

      if (upsertError) throw upsertError;

      // Propagasi target ke bulan berikutnya (carry-over)
      const nextPeriod = getNextPeriod(selectedPeriod);
      if (nextPeriod) {
        setPropagating(true);
        const propError = await propagateTargetToNextMonth(
          targetPuskesmasCode,
          selectedProgramType,
          records,
        );
        setPropagating(false);

        if (propError) {
          logger.error("Propagation error", propError);
          const currentMonthNum = parseInt(selectedPeriod.split("-")[1]);
          const nextMonthNum = currentMonthNum + 1;
          const monthNames = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
          showToast(
            `Data tersimpan, tapi gagal menyalin target ke ${monthNames[nextMonthNum]}: ${propError.message}`,
            "error",
          );
        } else {
          showToast(
            `Data ${getProgramLabel(selectedProgramType)} berhasil disimpan! Target otomatis diteruskan ke bulan berikutnya.`,
            "success",
          );
        }
      } else {
        // December - no next month
        showToast(
          `Data ${getProgramLabel(selectedProgramType)} berhasil disimpan!`,
          "success",
        );
      }

      setIsEditMode(true);
    } catch (err) {
      logger.error("Save error", err);
      showToast("Gagal menyimpan: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  // Get selected puskesmas name
  const getSelectedPuskesmasName = () => {
    const pkm = puskesmasList.find((p) => p.code === selectedPuskesmas);
    return pkm?.name || selectedPuskesmas;
  };

  // Check if non-January period (for auto-fill visual cues)
  const isNonJanuary = selectedPeriod && !isJanuaryPeriod(selectedPeriod);

  // Render Input Row
  const renderInputRow = (indicator, idx, startNo = 1) => {
    const data = formData[indicator.indicator_name] || {
      target: 0,
      realization: 0,
      unit: "Orang",
    };
    const metrics = calculateMetrics(data.target, data.realization);
    const unit = data.unit || indicator.unit || "Orang";

    return (
      <tr
        key={indicator.indicator_name}
        className={`${idx % 2 === 0 ? "bg-white" : "bg-slate-50"} hover:bg-blue-50 transition-colors`}
      >
        <td className="px-4 py-3 text-center text-sm text-slate-600 font-medium">
          {startNo + idx}
        </td>
        <td className="px-4 py-3 text-sm text-slate-800">
          {indicator.indicator_name}
        </td>
        <td className="px-4 py-3 text-center text-sm text-slate-500 font-medium">
          {unit}
        </td>

        {/* Target Input - Styled differently when auto-filled from January */}
        <td className="px-4 py-3">
          <div className="relative">
            <input
              type="number"
              min="0"
              value={data.target}
              onChange={(e) =>
                handleInputChange(
                  indicator.indicator_name,
                  "target",
                  e.target.value,
                )
              }
              className={`w-full px-3 py-2 text-center border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 tabular-nums ${
                isTargetAutoFilled
                  ? "border-green-300 bg-green-50 text-green-800"
                  : "border-slate-300"
              }`}
              placeholder={`Target (${unit})`}
            />

          </div>
        </td>

        {/* Realisasi Input - Highlighted for non-January periods */}
        <td className="px-4 py-3">
          <input
            type="number"
            min="0"
            value={data.realization}
            onChange={(e) =>
              handleInputChange(
                indicator.indicator_name,
                "realization",
                e.target.value,
              )
            }
            className={`w-full px-3 py-2 text-center border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 tabular-nums font-semibold ${
              isNonJanuary
                ? "border-blue-400 bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                : "border-slate-300 text-blue-600"
            }`}
            placeholder={isNonJanuary ? `Isi Realisasi` : `Realisasi (${unit})`}
          />
        </td>

        {/* % Capaian - Real-time */}
        <td className="px-4 py-3 text-center">
          <span
            className={`text-lg font-bold tabular-nums ${metrics.isTuntas ? "text-emerald-600" : "text-red-600"}`}
          >
            {metrics.percentage}%
          </span>
        </td>

        {/* Belum Terlayani - Real-time */}
        <td className="px-4 py-3 text-center">
          <span
            className={`font-semibold tabular-nums ${metrics.unserved > 0 ? "text-red-600" : "text-emerald-600"}`}
          >
            {metrics.unserved.toLocaleString("id-ID")}
          </span>
        </td>

        {/* Status Badge - Real-time */}
        <td className="px-4 py-3 text-center">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${metrics.isTuntas ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}
          >
            {metrics.isTuntas ? "✓ TUNTAS" : "✗ BELUM"}
          </span>
        </td>
      </tr>
    );
  };

  // Loading state
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  // Get program-specific indicators dynamically
  const programIndicators = selectedProgramType
    ? getIndicatorsForProgram(selectedProgramType)
    : { sectionA: [], sectionBBarang: [], sectionBSDM: [] };

  // Prepare section data - DINAMIS BERDASARKAN PROGRAM
  const sectionAData = indicators.filter((ind) =>
    programIndicators.sectionA.includes(ind.indicator_name),
  );
  const sectionBBarangData = indicators.filter((ind) =>
    programIndicators.sectionBBarang.includes(ind.indicator_name),
  );
  const sectionBSdmData = indicators.filter((ind) =>
    programIndicators.sectionBSDM.includes(ind.indicator_name),
  );

  // Get program theme if selected
  const programTheme = selectedProgramType
    ? getProgram(selectedProgramType).theme
    : null;
  const programConfig = selectedProgramType
    ? getProgram(selectedProgramType)
    : null;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Toast Notification */}
        {toast.show && (
          <div
            className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transition-all transform ${
              toast.type === "success"
                ? "bg-emerald-500 text-white"
                : "bg-red-500 text-white"
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === "success" ? (
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
              ) : (
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
              )}
              {toast.message}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                Input Data Capaian SPM
              </h1>
              <p className="text-slate-600 mt-1">
                {isEditMode ? (
                  <span className="inline-flex items-center gap-1 text-amber-600">
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
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    Mode Edit - Data sudah ada untuk periode ini
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-blue-600">
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
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                    Mode Input Baru
                  </span>
                )}
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-end gap-3">
              {/* WAJIB: Program Type Selector - Paling Atas */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  Jenis Layanan <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedProgramType}
                  onChange={(e) => {
                    setSelectedProgramType(e.target.value);
                    setProgramTypeError(false);
                  }}
                  className={`px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[200px] ${
                    programTypeError
                      ? "border-red-500 bg-red-50"
                      : "border-slate-300"
                  }`}
                >
                  <option value="">-- Pilih Jenis Layanan --</option>
                  {PROGRAM_TYPES_LIST.map((program) => (
                    <option key={program.value} value={program.value}>
                      {program.label}
                    </option>
                  ))}
                </select>
                {programTypeError && (
                  <p className="text-xs text-red-500 mt-1">Wajib dipilih!</p>
                )}
              </div>

              {/* Puskesmas Selector - Only for Admin */}
              {isAdmin ? (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Puskesmas
                  </label>
                  <select
                    value={selectedPuskesmas}
                    onChange={(e) => setSelectedPuskesmas(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[200px]"
                  >
                    <option value="">-- Pilih Puskesmas --</option>
                    {puskesmasList.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-600">Puskesmas</p>
                  <p className="font-semibold text-blue-800">
                    {getSelectedPuskesmasName()}
                  </p>
                </div>
              )}

              {/* Period Selector - Dropdown Per Bulan */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  Periode (Per Bulan)
                </label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[200px]"
                >
                  {periodOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Program Type Warning Banner */}
          {!selectedProgramType && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-center gap-3">
              <svg
                className="w-6 h-6 text-amber-600 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <p className="font-semibold text-amber-800">
                  Pilih Jenis Layanan Terlebih Dahulu
                </p>
                <p className="text-sm text-amber-700">
                  Anda harus memilih jenis layanan (Hipertensi / Diabetes /
                  ODGJ) sebelum dapat menginput data.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
            <p className="text-red-600">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700"
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
        )}

        {/* Loading Data Indicator */}
        {loadingData && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
            <svg
              className="animate-spin h-5 w-5 text-blue-600"
              viewBox="0 0 24 24"
            >
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
            <p className="text-blue-600">
              Memuat data untuk periode yang dipilih...
            </p>
          </div>
        )}

        {/* No Puskesmas Selected (Admin) */}
        {isAdmin && !selectedPuskesmas && selectedProgramType && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
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
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h2 className="text-lg font-semibold text-amber-800">
              Pilih Puskesmas
            </h2>
            <p className="text-amber-700 mt-2">
              Sebagai Admin, Anda dapat memilih Puskesmas mana yang akan
              diinput/edit datanya.
            </p>
          </div>
        )}

        {/* Form Sections - Only show when ProgramType AND Puskesmas selected */}
        {selectedProgramType &&
          selectedPuskesmas &&
          indicators.length > 0 &&
          !loadingData && (
            <>
              {/* Info Banner: Target Auto-Fill */}
              {isJanuaryPeriod(selectedPeriod) && !isEditMode && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-300 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-green-800">Periode Januari - Input Target Awal</p>
                    <p className="text-sm text-green-700">
                      Isi semua target di bulan Januari. Saat disimpan, target akan <strong>otomatis diteruskan ke bulan berikutnya</strong>.
                      Di bulan-bulan berikutnya, target bisa disesuaikan sesuai kebutuhan.
                    </p>
                  </div>
                </div>
              )}

              {isTargetAutoFilled && (
                <div className="bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-300 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-sky-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-sky-800">Target & Realisasi Otomatis dari Bulan Sebelumnya</p>
                    <p className="text-sm text-sky-700">
                      Target dan Realisasi sudah terisi otomatis dari bulan sebelumnya. Anda bisa <strong>menambahkan/menyesuaikan angka</strong> sesuai kebutuhan,
                      lalu simpan.
                    </p>
                  </div>
                </div>
              )}

              {/* Propagating Indicator */}
              {propagating && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-center gap-3">
                  <svg className="animate-spin h-5 w-5 text-amber-600" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <p className="text-amber-700 font-medium">Meneruskan target ke bulan berikutnya...</p>
                </div>
              )}

              {/* Current Selection Badge */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
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
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-blue-600">
                      Sedang Menginput Data:
                    </p>
                    <p className="font-bold text-blue-900">
                      {getProgramLabel(selectedProgramType)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Periode</p>
                  <p className="font-semibold text-slate-700">
                    {formatPeriodLabel(selectedPeriod)}
                  </p>
                </div>
              </div>

              {/* SECTION A: PENERIMAAN LAYANAN DASAR */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 bg-blue-100 border-b border-blue-200">
                  <h2 className="text-lg font-bold text-blue-900">
                    A. PENERIMAAN LAYANAN DASAR (100%)
                  </h2>
                  <p className="text-sm text-blue-700 mt-1">
                    Jumlah sasaran yang wajib mendapat pelayanan SPM
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-blue-800 text-white">
                        <th className="px-4 py-3 text-center text-sm font-semibold w-12">
                          No
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">
                          Indikator SPM
                        </th>
                        <th className="px-4 py-3 text-center text-sm font-semibold w-24">
                          Satuan
                        </th>
                        <th className="px-4 py-3 text-center text-sm font-semibold w-32">
                          Target
                        </th>
                        <th className="px-4 py-3 text-center text-sm font-semibold w-32">
                          Realisasi
                        </th>
                        <th className="px-4 py-3 text-center text-sm font-semibold w-28">
                          % Capaian
                        </th>
                        <th className="px-4 py-3 text-center text-sm font-semibold w-32">
                          Belum Terlayani
                        </th>
                        <th className="px-4 py-3 text-center text-sm font-semibold w-28">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectionAData.map((ind, idx) =>
                        renderInputRow(ind, idx, 1),
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION B: MUTU MINIMAL */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 bg-gray-100 border-b border-gray-200">
                  <h2 className="text-lg font-bold text-gray-900">
                    B. MUTU MINIMAL (BARANG / JASA / SDM)
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Ketersediaan sarana, prasarana, dan sumber daya manusia
                  </p>
                </div>

                {/* Sub-section: Barang & Jasa */}
                <div className="border-b border-gray-200">
                  <div className="px-6 py-2 bg-amber-50 border-b border-amber-100">
                    <h3 className="text-sm font-semibold text-amber-800">
                      📦 Barang & Jasa
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-amber-700 text-white">
                          <th className="px-4 py-3 text-center text-sm font-semibold w-12">
                            No
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold">
                            Indikator SPM
                          </th>
                          <th className="px-4 py-3 text-center text-sm font-semibold w-24">
                            Satuan
                          </th>
                          <th className="px-4 py-3 text-center text-sm font-semibold w-32">
                            Target
                          </th>
                          <th className="px-4 py-3 text-center text-sm font-semibold w-32">
                            Realisasi
                          </th>
                          <th className="px-4 py-3 text-center text-sm font-semibold w-28">
                            % Capaian
                          </th>
                          <th className="px-4 py-3 text-center text-sm font-semibold w-32">
                            Belum Terlayani
                          </th>
                          <th className="px-4 py-3 text-center text-sm font-semibold w-28">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sectionBBarangData.map((ind, idx) =>
                          renderInputRow(ind, idx, 2),
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Sub-section: SDM Kesehatan */}
                <div>
                  <div className="px-6 py-2 bg-purple-50 border-b border-purple-100">
                    <h3 className="text-sm font-semibold text-purple-800">
                      👨‍⚕️ SDM Kesehatan
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-purple-700 text-white">
                          <th className="px-4 py-3 text-center text-sm font-semibold w-12">
                            No
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold">
                            Indikator SPM
                          </th>
                          <th className="px-4 py-3 text-center text-sm font-semibold w-24">
                            Satuan
                          </th>
                          <th className="px-4 py-3 text-center text-sm font-semibold w-32">
                            Target
                          </th>
                          <th className="px-4 py-3 text-center text-sm font-semibold w-32">
                            Realisasi
                          </th>
                          <th className="px-4 py-3 text-center text-sm font-semibold w-28">
                            % Capaian
                          </th>
                          <th className="px-4 py-3 text-center text-sm font-semibold w-32">
                            Belum Terlayani
                          </th>
                          <th className="px-4 py-3 text-center text-sm font-semibold w-28">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sectionBSdmData.map((ind, idx) =>
                          renderInputRow(ind, idx, 7),
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Save Button - Bottom */}
              <div className="flex flex-col items-end gap-2">
                <p className="text-xs text-green-600 italic">
                  * Target otomatis diteruskan ke bulan berikutnya saat disimpan
                </p>
                <button
                  onClick={handleSave}
                  disabled={
                    saving ||
                    propagating ||
                    loadingData ||
                    !selectedPuskesmas ||
                    !selectedProgramType
                  }
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-xl transition-colors flex items-center gap-2 text-lg shadow-lg"
                >
                  {saving || propagating ? (
                    <>
                      <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
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
                      {propagating ? "Meneruskan target..." : "Menyimpan..."}
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                        />
                      </svg>
                      Simpan Data
                    </>
                  )}
                </button>
              </div>
            </>
          )}

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">
            📝 Petunjuk Penggunaan:
          </h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>
              • <strong className="text-red-600">WAJIB:</strong> Pilih{" "}
              <strong>Jenis Layanan</strong> terlebih dahulu (Hipertensi /
              Diabetes / ODGJ)
            </li>
            {isAdmin && (
              <li>
                • <strong>Admin:</strong> Pilih Puskesmas yang akan diinput/edit
                datanya
              </li>
            )}
            <li>
              • Pilih <strong>Periode Bulan</strong> untuk input data (Januari
              s/d Desember)
            </li>
            <li>
              • <strong>Section A:</strong> Jumlah sasaran yang harus dilayani
            </li>
            <li>
              • <strong>Section B:</strong> Ketersediaan barang/jasa dan SDM
            </li>
            <li>
              • <strong>Satuan</strong> ditampilkan sesuai database (Orang,
              Paket, Unit, Aplikasi)
            </li>
            <li>
              • <strong>% Capaian</strong> dihitung real-time: (Realisasi /
              Target) × 100
            </li>
            <li>
              • Klik <strong>Simpan Semua Data</strong> di bagian bawah untuk
              menyimpan
            </li>
            <li>
              • <strong className="text-green-600">OTOMATIS:</strong> Target
              otomatis diisi dari <strong>bulan sebelumnya</strong>. Anda bisa
              menyesuaikan target jika ada perubahan, lalu simpan. Target yang
              disimpan akan diteruskan ke <strong>bulan berikutnya</strong>.
            </li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}
