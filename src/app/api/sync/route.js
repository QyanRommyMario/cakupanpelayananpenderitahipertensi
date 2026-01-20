import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    // Validate sync token
    const syncToken = request.headers.get("x-sync-token");
    if (syncToken !== process.env.SYNC_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Handle payload from Google Apps Script: { period: "TW4-2025", data: [...] }
    const { period, data: records } = body;

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
      } = record;

      if (!puskesmas_code || !indicator_name) {
        errors.push({ record, error: "Missing required fields" });
        continue;
      }

      const targetNum = parseFloat(target_qty) || 0;
      const realizationNum = parseFloat(realization_qty) || 0;
      const unservedNum = parseFloat(unserved_qty) || 0;

      const { error } = await supabase.from("achievements").upsert(
        {
          puskesmas_code,
          indicator_name,
          period,
          target_qty: targetNum,
          realization_qty: realizationNum,
          unserved_qty: unservedNum,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "puskesmas_code,indicator_name,period" },
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
