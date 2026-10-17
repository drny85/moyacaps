"use client";

import { useStore } from "@/store/useStore";
import { ModelLookbookStudio } from "./ModelLookbookStudio";

export function ModelLookbookStudioModal() {
  const { isApparelStudioOpen, closeApparelStudio } = useStore();

  if (!isApparelStudioOpen) return null;

  return <ModelLookbookStudio isModal onClose={closeApparelStudio} />;
}
