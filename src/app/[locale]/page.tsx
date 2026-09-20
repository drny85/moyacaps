import { HeroInteractive } from "@/components/hero/HeroInteractive";
import { DropRadar } from "@/components/drops/DropRadar";
import { CapGrid } from "@/components/catalog/CapGrid";
import { AnatomyParallax } from "@/components/story/AnatomyParallax";
import { BrandStory } from "@/components/story/BrandStory";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-0 overflow-hidden">
      <AnatomyParallax />
      <HeroInteractive />
      <DropRadar />
      <CapGrid />
      <BrandStory />
    </div>
  );
}
