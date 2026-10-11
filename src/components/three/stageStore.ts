import { create } from "zustand";

/**
 * Coordination between the single shared <Canvas> (CapStage) and the
 * <View>s that render into it from the hero and anatomy sections.
 */
interface StageState {
  /** Views currently on screen — the canvas stops its render loop at 0 */
  visibleViews: number;
  /** Lowered by PerformanceMonitor on slow devices: drops shadows */
  quality: "high" | "low";
  /** The hero model has mounted and can replace the poster image */
  heroReady: boolean;
  setVisible: (delta: 1 | -1) => void;
  setQuality: (quality: "high" | "low") => void;
  setHeroReady: (ready: boolean) => void;
}

export const useStageStore = create<StageState>((set) => ({
  visibleViews: 0,
  quality: "high",
  heroReady: false,
  setVisible: (delta) => set((s) => ({ visibleViews: Math.max(0, s.visibleViews + delta) })),
  setQuality: (quality) => set({ quality }),
  setHeroReady: (heroReady) => set({ heroReady }),
}));
