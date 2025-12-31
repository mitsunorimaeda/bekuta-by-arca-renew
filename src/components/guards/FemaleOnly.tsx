import React from "react";

export function FemaleOnly({
  gender,
  fallback,
  children,
}: {
  gender: "female" | "male" | null;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (gender !== "female") return <>{fallback ?? null}</>;
  return <>{children}</>;
}