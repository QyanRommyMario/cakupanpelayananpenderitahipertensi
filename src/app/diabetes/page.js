"use client";
import ProgramDashboard from "@/components/ProgramDashboard";
import { PROGRAM_TYPES } from "@/utils/constants";

export default function DiabetesPage() {
  return (
    <ProgramDashboard 
      programType={PROGRAM_TYPES.DIABETES} 
      title="Dashboard SPM Diabetes Melitus"
    />
  );
}
