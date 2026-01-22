"use client";
import ProgramDashboard from "@/components/ProgramDashboard";
import { PROGRAM_TYPES } from "@/utils/constants";

export default function ODGJPage() {
  return (
    <ProgramDashboard 
      programType={PROGRAM_TYPES.ODGJ} 
      title="Dashboard SPM ODGJ (Kesehatan Jiwa)"
    />
  );
}
