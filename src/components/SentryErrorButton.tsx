// src/components/SentryErrorButton.tsx
import React from "react";

export function SentryErrorButton() {
  return (
    <button
      type="button"
      onClick={() => {
        throw new Error("This is your first error!");
      }}
      className="rounded-lg border px-3 py-2 text-sm"
    >
      Break the world
    </button>
  );
}