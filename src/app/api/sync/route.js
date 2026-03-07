import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Valid program types - harus sinkron dengan constants.js
const VALID_PROGRAM_TYPES = [
  "USIA_PRODUKTIF",
  "HIPERTENSI",
  "DIABETES",
  "ODGJ",
];

export async function POST(request) {
  try {
    // Validate sync token
    const syncToken = request.headers.get("x-sync-token");
    if (syncToken !== process.env.SYNC_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Handle payload from Google Apps Script: { period: "TW4-2025", program_type: "HIPERTENSI", data: [...] }
    const { period, program_type, data: records } = body;

    if (!records || !Array.isArray(records)) {
      return NextResponse.json(
        { error: "Invalid payload: data array required" },
        { status: 400 },
      );
    }

    if (!period) {
      return NextResponse.json(
        { error: "Invalid payload: period required" },
        { status: 400 },
      );
    }

    // Validasi program_type WAJIB ada (dari body level atau per-record)
    if (program_type && !VALID_PROGRAM_TYPES.includes(program_type)) {
      return NextResponse.json(
        {
          error: `Invalid program_type: "${program_type}". Valid: ${VALID_PROGRAM_TYPES.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Use service role key for admin operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    let upserted = 0;
    let errors = [];

    for (const record of records) {
      const {
        puskesmas_code,
        indicator_name,
        target_qty,
        realization_qty,
        unserved_qty,
        program_type: recordProgramType,
      } = record;

      // Gunakan program_type dari record, fallback ke body-level
      const effectiveProgramType = recordProgramType || program_type;

      if (!puskesmas_code || !indicator_name) {
        errors.push({ record, error: "Missing required fields (puskesmas_code, indicator_name)" });
        continue;
      }

      // WAJIB: program_type harus ada
      if (!effectiveProgramType) {
        errors.push({
          record,
          error: "Missing program_type. Sertakan di body atau per-record.",
        });
        continue;
      }

      if (!VALID_PROGRAM_TYPES.includes(effectiveProgramType)) {
        errors.push({
          record,
          error: `Invalid program_type: "${effectiveProgramType}"`,
        });
        continue;
      }

      const targetNum = parseFloat(target_qty) || 0;
      const realizationNum = parseFloat(realization_qty) || 0;
      const unservedNum =
        parseFloat(unserved_qty) || Math.max(0, targetNum - realizationNum);

      const { error } = await supabase.from("achievements").upsert(
        {
          puskesmas_code,
          indicator_name,
          period,
          program_type: effectiveProgramType,
          target_qty: targetNum,
          realization_qty: realizationNum,
          unserved_qty: unservedNum,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict:
            "puskesmas_code,indicator_name,period,program_type",
        },
      );

      if (error) {
        errors.push({ record, error: error.message });
      } else {
        upserted++;
      }
    }

    return NextResponse.json({
      success: true,
      period,
      program_type: program_type || "(per-record)",
      upserted,
      total: records.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: "SPM Dashboard Sync API",
    usage: "POST with x-sync-token header and { period, data: [...] } body",
  });
}
