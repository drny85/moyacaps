"use client";

import { useTranslations } from "next-intl";
import { Sparkles, Flame, Clover } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";

/** Animated counter that counts up when scrolled into view */
function AnimatedStat({ value, label, description, delay = 0 }: {
  value: string;
  label: string;
  description: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const [displayed, setDisplayed] = useState(false);

  useEffect(() => {
    if (isInView) {
      const timer = setTimeout(() => setDisplayed(true), delay * 1000);
      return () => clearTimeout(timer);
    }
  }, [isInView, delay]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay }}
      className="border-b border-white/[0.06] pb-6 last:border-b-0 last:pb-0"
    >
      <div
        className={`text-4xl sm:text-5xl font-display font-bold text-gradient-moya transition-all duration-500 ${
          displayed ? "animate-count-bounce" : "opacity-0"
        }`}
      >
        {value}
      </div>
      <div className="text-sm font-display font-semibold text-zinc-200 mt-1.5 uppercase tracking-wider">
        {label}
      </div>
      <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
        {description}
      </p>
    </motion.div>
  );
}

export function BrandStory() {
  const t = useTranslations("story");

  return (
    <section
      id="story"
      className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-t border-white/[0.04] relative overflow-hidden bg-[#050508]"
    >
      {/* ── Background Treatment ── */}
      <div className="absolute inset-0 texture-lines pointer-events-none" />
      <div className="ambient-orb top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-moya-red/10" />
      <div className="ambient-orb bottom-0 right-1/4 w-[400px] h-[200px] bg-moya-violet/8" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* ── Left: Editorial Narrative ── */}
          <div className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, y: 10, rotate: -3 }}
              whileInView={{ opacity: 1, y: 0, rotate: -2 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="sticker-badge sticker-badge--violet mb-6"
            >
              <Sparkles className="w-3 h-3" />
              <span>{t("eyebrow")}</span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-display text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-6 sm:mb-8 leading-[1.05]"
            >
              {t("title")}
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-zinc-300 text-base sm:text-lg leading-relaxed mb-5 font-sans"
            >
              {t("part1")}
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-zinc-500 text-sm sm:text-base leading-relaxed mb-10 font-sans"
            >
              {t("part2")}
            </motion.p>

            {/* ── Pillar Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="glass-dark p-5 rounded-2xl flex items-start gap-3 border border-moya-green/20 hover:border-moya-green/40 transition-colors group"
              >
                <div className="w-9 h-9 rounded-xl bg-moya-green/15 flex items-center justify-center shrink-0 group-hover:bg-moya-green/25 transition-colors">
                  <Clover className="w-4 h-4 text-moya-green-light" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-sm text-white">{t("pillarFortuneTitle")}</h4>
                  <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                    {t("pillarFortuneDesc")}
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.4 }}
                className="glass-dark p-5 rounded-2xl flex items-start gap-3 border border-moya-red/20 hover:border-moya-red/40 transition-colors group"
              >
                <div className="w-9 h-9 rounded-xl bg-moya-red/15 flex items-center justify-center shrink-0 group-hover:bg-moya-red/25 transition-colors">
                  <Flame className="w-4 h-4 text-moya-red-light" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-sm text-white">{t("pillarAudacityTitle")}</h4>
                  <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                    {t("pillarAudacityDesc")}
                  </p>
                </div>
              </motion.div>
            </div>
          </div>

          {/* ── Right: Stats Card with Animated Counters ── */}
          <div className="lg:col-span-5">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="glass-card rounded-3xl p-8 sm:p-10 border border-white/[0.06] relative overflow-hidden shadow-2xl"
            >
              {/* Inner gradient accent */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-moya-red/10 rounded-full blur-[80px] pointer-events-none" />

              <div className="flex flex-col gap-6 relative z-10">
                <AnimatedStat
                  value={t("stat1Value")}
                  label={t("stat1Label")}
                  description={t("stat1Desc")}
                  delay={0.1}
                />
                <AnimatedStat
                  value={t("stat2Value")}
                  label={t("stat2Label")}
                  description={t("stat2Desc")}
                  delay={0.3}
                />
                <AnimatedStat
                  value={t("stat3Value")}
                  label={t("stat3Label")}
                  description={t("stat3Desc")}
                  delay={0.5}
                />
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
