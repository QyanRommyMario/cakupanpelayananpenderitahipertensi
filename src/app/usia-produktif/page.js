"use client";
import ProgramDashboard from "@/components/ProgramDashboard";
import { PROGRAM_TYPES } from "@/utils/constants";

export default function UsiaProduktifPage() {
  return (
    <ProgramDashboard 
      programType={PROGRAM_TYPES.USIA_PRODUKTIF} 
      title="Dashboard SPM Usia Produktif"
    />
  );
}
