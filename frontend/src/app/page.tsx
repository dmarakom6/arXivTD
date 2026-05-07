"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { Shield, Search, GitBranch, Clock, ArrowRight, ChevronLeft, ChevronRight, HandCoins, CheckCircle2, Verified, Check, Heart } from "lucide-react";

const features = [
  {
    icon: Search,
    title: "Citation Validation",
    description: "Verify that citations actually exist and are relevant to the paper.",
  },
  {
    icon: Clock,
    title: "Reference Age Analysis",
    description: "Check if references are up-to-date or outdated for your field.",
  },
  {
    icon: GitBranch,
    title: "Code Provenance",
    description: "Find if code referenced in the paper exists on GitHub with proper licensing.",
  },
  {
    icon: Shield,
    title: "AI Detection",
    description: "Detect potential AI-generated content in academic papers.",
  },
  {
    icon: Search,
    title: "Trust Scoring",
    description: "Get a comprehensive trust score based on multiple factors.",
  },
  {
    icon: GitBranch,
    title: "Citation Graphs",
    description: "Visualize connections between papers with Semantic Scholar integration.",
  },
];

function ParallaxHero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const parallaxY1 = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const parallaxY2 = useTransform(scrollYProgress, [0, 1], ["0%", "-30%"]);
  const parallaxY3 = useTransform(scrollYProgress, [0, 1], ["0%", "40%"]);
  const parallaxY4 = useTransform(scrollYProgress, [0, 1], ["0%", "-40%"]);
  const primaryColor = "var(--primary)";
  const secondaryColor = "var(--secondary)";

  return (
    <div
      ref={ref}
      className="relative min-h-[80vh] flex items-center justify-center overflow-hidden bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900"
    >
      <div className="subtle-pattern"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 30%, var(--secondary) 1px, transparent 1px), radial-gradient(circle at 80% 70%, var(--secondary) 1px, transparent 1px), radial-gradient(circle at 50% 50%, var(--secondary) 0.5px, transparent 0.5px)`,
          backgroundSize: '60px 60px, 80px 80px, 40px 40px',
        }}
      />

      <motion.div style={{ y: parallaxY1, backgroundColor: 'color-mix(in srgb, var(--primary) 20%, transparent)' }} className="floating-rect w-20 h-32 -top-10 left-[10%] rounded-lg" />
      <motion.div style={{ y: parallaxY2, backgroundColor: 'color-mix(in srgb, var(--primary) 15%, transparent)' }} className="floating-rect-reverse w-16 h-24 top-[20%] right-[15%] rounded-lg" />
      <motion.div style={{ y: parallaxY3, backgroundColor: 'color-mix(in srgb, var(--primary) 10%, transparent)' }} className="floating-rect w-24 h-16 bottom-[20%] left-[20%] rounded-lg" />
      <motion.div style={{ y: parallaxY4, backgroundColor: 'color-mix(in srgb, var(--primary) 15%, transparent)' }} className="floating-rect-reverse w-12 h-20 top-[60%] right-[10%] rounded-lg" />

      <motion.div style={{ y }} className="absolute inset-0 pointer-events-none">
        <motion.div style={{ y: parallaxY1, backgroundColor: 'color-mix(in srgb, var(--primary) 10%, transparent)' }} className="floating-rect w-16 h-20 bottom-[30%] left-[5%] rounded-lg" />
        <motion.div style={{ y: parallaxY2, backgroundColor: 'color-mix(in srgb, var(--primary) 10%, transparent)' }} className="floating-rect-reverse w-20 h-16 top-[40%] right-[20%] rounded-lg" />
      </motion.div>

      <motion.div style={{ opacity }} className="relative z-10 max-w-4xl mx-auto px-4 text-center">
        <motion.h1
          whileInView={{ opacity: 1, y: 0 }}
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: false }}
          className="text-6xl md:text-8xl font-bold font-serif mb-6"
          style={{ color: primaryColor }}
        >
          ArXivTD
        </motion.h1>

        <motion.p
          whileInView={{ opacity: 1, y: 0 }}
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          viewport={{ once: false }}
          className="text-xl md:text-2xl text-zinc-600 dark:text-zinc-400 mb-8"
        >
          Academic Paper Trust Analysis
        </motion.p>

        <motion.p
          whileInView={{ opacity: 1, y: 0 }}
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: false }}
          className="text-lg text-zinc-500 dark:text-zinc-500 max-w-2xl mx-auto mb-10"
        >
          Detect citation hallucinations, validate references, check code provenance,
          and identify AI-generated content in academic papers.
        </motion.p>

        <motion.div
          whileInView={{ opacity: 1, y: 0 }}
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: false }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Link
            href="/register"
            className="group inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-md font-medium text-white transition-all hover:scale-105"
            style={{ backgroundColor: primaryColor }}
          >
            Earn Your Free Credits <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          {/* <Link
            href="/analyze"
            className="group inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-md font-medium border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all hover:scale-105"
          >
            Try Demo
          </Link> */}
        </motion.div>
      </motion.div>
    </div>
  );
}

function FeaturesCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const primaryColor = "var(--primary)";
  const cardsPerView = 3;
  const totalCards = features.length;
  // maxIndex is the last index where a full set of cards is visible
  const maxIndex = totalCards - cardsPerView;

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev < maxIndex ? prev + 1 : 0));
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : maxIndex));
  };

  return (
    <section className="px-4 bg-zinc-50 dark:bg-zinc-900">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <motion.h2
            whileInView={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 20 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold font-serif mb-4"
          >
            Comprehensive Paper Analysis
          </motion.h2>
          <motion.p
            whileInView={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 10 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto text-lg"
          >
            Our AI-powered analysis examines every aspect of academic papers to give you a comprehensive trust score.
          </motion.p>
        </div>

        <div className="relative px-0 md:px-4">
          {/* Main Viewport */}
          <div className="relative overflow-visible py-12 -my-12">
            <div className="overflow-hidden -mx-5 py-12 -my-12">
              <motion.div
                className="flex"
                initial={false}
                animate={{ x: `-${currentIndex * (100 / cardsPerView)}%` }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 32,
                  mass: 1
                }}
              >
                {features.map((feature, i) => (
                  <div key={i} className="w-full md:w-1/3 flex-shrink-0 px-3">
                    <motion.div
                      whileHover={{
                        y: -12,
                        scale: 1.02,
                      }}
                      transition={{ type: "spring", stiffness: 400, damping: 17 }}
                      className="h-full bg-white dark:bg-zinc-800 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.2)] transition-all duration-300 min-h-[260px] flex flex-col group"
                    >
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 duration-300"
                        style={{ backgroundColor: `color-mix(in srgb, ${primaryColor} 10%, transparent)` }}
                      >
                        <feature.icon
                          className="h-6 w-6"
                          style={{ color: primaryColor }}
                        />
                      </div>
                      <h3 className="text-xl font-bold mb-3 font-serif">{feature.title}</h3>
                      <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed text-sm flex-1">
                        {feature.description}
                      </p>

                      <Link
                        href="/pricing#features"
                        className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-700/50 flex items-center text-xs font-semibold uppercase tracking-wider text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors"
                      >
                        Learn More <ArrowRight className="h-3 w-3 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </motion.div>
                  </div>
                ))}
              </motion.div>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 pointer-events-none flex justify-between px-0 md:-mx-16 z-20">
            <motion.button
              onClick={prevSlide}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="pointer-events-auto h-12 w-12 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-xl flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
            >
              <ChevronLeft className="h-6 w-6 text-zinc-600 dark:text-zinc-300" />
            </motion.button>
            <motion.button
              onClick={nextSlide}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="pointer-events-auto h-12 w-12 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-xl flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
            >
              <ChevronRight className="h-6 w-6 text-zinc-600 dark:text-zinc-300" />
            </motion.button>
          </div>

          {/* Indicators */}
          <div className="flex justify-center gap-3 mt-12 pb-5">
            {Array.from({ length: maxIndex + 1 }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className="group relative p-2"
              >
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${i === currentIndex
                    ? "w-8 bg-[var(--primary)]"
                    : "w-2 bg-zinc-300 dark:bg-zinc-700 group-hover:bg-zinc-400"
                    }`}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ScoreSimulator() {
  const [factors, setFactors] = useState({
    citations: 85,
    age: 92,
    code: 78,
    ai: 88,
  });

  const primaryColor = "var(--primary)";

  const calculateScore = () => {
    return Math.round(
      factors.citations * 0.35 +
      factors.age * 0.2 +
      factors.code * 0.25 +
      factors.ai * 0.2
    );
  };

  const score = calculateScore();

  const getScoreColor = () => {
    if (score >= 80) return "text-emerald-500";
    if (score >= 60) return "text-amber-500";
    return "text-rose-500";
  };

  const getScoreMessage = () => {
    if (score >= 80) return "High Trust";
    if (score >= 60) return "Verify Carefully";
    return "Use with Caution";
  };

  return (
    <section className="py-32 px-4 bg-white dark:bg-zinc-950 border-y border-zinc-100 dark:border-zinc-900 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-20">
          <motion.h2
            whileInView={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 20 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold font-serif mb-4"
          >
            How Trust is Calculated
          </motion.h2>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto text-lg">
            Our multi-dimensional analysis examines every signal to provide a transparent,
            verifiable metric of academic integrity.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-16 items-center px-4">
          {/* Controls */}
          <div className="w-full lg:w-1/2 space-y-10 order-2 lg:order-1">
            {[
              { id: "citations", label: "Citation Validation", icon: Search, description: "Checks if cited papers exist and are properly contextually linked." },
              { id: "age", label: "Reference Recency", icon: Clock, description: "Analyzes the distribution of reference ages relative to the field." },
              { id: "code", label: "Code Provenance", icon: GitBranch, description: "Verifies repository active status, license compatibility, and reproducibility." },
              { id: "ai", label: "Authenticity Check", icon: Shield, description: "Scans for syntactic and structural markers typical of LLM-generated text." },
            ].map((factor, index) => (
              <motion.div
                key={factor.id}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="space-y-4"
              >
                <div className="flex justify-between items-end">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
                      <factor.icon className="h-5 w-5" style={{ color: primaryColor }} />
                    </div>
                    <div>
                      <h4 className="font-bold text-zinc-900 dark:text-white leading-tight">{factor.label}</h4>
                      <p className="text-xs text-zinc-400 hidden md:block">{factor.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-mono font-bold" style={{ color: primaryColor }}>
                      {factors[factor.id as keyof typeof factors]}%
                    </span>
                  </div>
                </div>
                <div className="relative pt-1">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={factors[factor.id as keyof typeof factors]}
                    onChange={(e) => setFactors({ ...factors, [factor.id]: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full appearance-none cursor-pointer accent-[var(--primary)]"
                  />
                  <motion.div
                    className="absolute top-1/2 -translate-y-1/2 h-4 w-4 bg-white dark:bg-zinc-700 border-2 rounded-full pointer-events-none shadow-sm"
                    style={{
                      borderColor: primaryColor,
                      left: `calc(${factors[factor.id as keyof typeof factors]}% - 8px)`
                    }}
                    animate={{ left: `calc(${factors[factor.id as keyof typeof factors]}% - 8px)` }}
                  />
                </div>
              </motion.div>
            ))}
          </div>

          {/* Result Visualization */}
          <div className="w-full lg:w-1/2 flex flex-col items-center justify-center order-1 lg:order-2">
            <div className="relative group">
              {/* Outer Glow */}
              <motion.div
                animate={{
                  scale: [1, 1.05, 1],
                  opacity: [0.1, 0.2, 0.1]
                }}
                transition={{ duration: 4, repeat: Infinity }}
                className="absolute -inset-10 rounded-full blur-3xl"
                style={{ backgroundColor: primaryColor }}
              />

              {/* Main Score Circle */}
              <motion.div
                className="relative w-64 h-64 md:w-80 md:h-80 rounded-full bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 shadow-2xl flex flex-col items-center justify-center z-10"
              >
                {/* SVG Progress Circle */}
                <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
                  <motion.circle
                    cx="50%"
                    cy="50%"
                    r="48%"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-zinc-100 dark:text-zinc-800"
                  />
                  <motion.circle
                    cx="50%"
                    cy="50%"
                    r="48%"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeDasharray="100 100"
                    strokeLinecap="round"
                    initial={{ strokeDashoffset: 100 }}
                    animate={{ strokeDashoffset: 100 - score }}
                    transition={{ type: "spring", stiffness: 50, damping: 15 }}
                    style={{ color: primaryColor }}
                  />
                </svg>

                <div className="text-center">
                  <motion.div
                    key={score}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-7xl md:text-8xl font-bold font-serif mb-2"
                    style={{ color: primaryColor }}
                  >
                    {score}
                  </motion.div>
                  <div className="text-xs uppercase tracking-[0.2em] text-zinc-400 font-bold mb-4">
                    Trust Score
                  </div>
                  <motion.div
                    className={`flex mx-auto px-4 text-center items-center justify-center py-1 rounded-full text-xs font-bold border w-fit ${getScoreColor() === 'text-emerald-500' ? 'bg-transparent dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20' : getScoreColor() === 'text-amber-500' ? 'bg-transparent dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20' : 'bg-transparent dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20'} ${getScoreColor()}`}
                  >
                    {getScoreMessage()}
                  </motion.div>
                </div>

                {/* Rotating Rings */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-8 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-full"
                />
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-12 border border-dotted border-zinc-200 dark:border-zinc-800 rounded-full"
                />
              </motion.div>

              {/* Floaties */}
              <AnimatePresence>
                {score >= 90 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0 }}
                    className="absolute -top-6 -right-6 bg-primary text-white p-3 rounded-full shadow-xl z-20"
                  >
                    <Check className="h-6 w-6" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PricingCTA() {
  const primaryColor = "var(--primary)";

  const plans = [
    {
      name: "Gemini Flash",
      description: "Fast, everyday validation",
      price: "12",
      credits: "100 credits",
      features: [
        "Speed-optimized processing",
        "Efficient for bulk tasks",
        "Lowest cost per credit"
      ], highlight: false
    },
    {
      name: "Claude Sonnet",
      description: "Deeper academic analysis",
      price: "20",
      credits: "100 credits",
      features: [
        "Advanced reasoning capabilities",
        "Strong code understanding",
        "Balanced speed & depth"
      ], highlight: true
    },
    {
      name: "Claude Opus",
      description: "Best for complex papers",
      price: "32",
      credits: "100 credits",
      features: [
        "Maximum analytical depth",
        "Best for complex papers",
        "Superior citation accuracy"
      ],
      highlight: false
    }
  ];

  return (
    <section className="py-32 px-4 relative overflow-hidden bg-zinc-50 dark:bg-zinc-900/50">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none opacity-50">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] bg-[var(--primary)]/10" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] bg-[var(--primary)]/10" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-20">
          <motion.h2
            whileInView={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 20 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold font-serif mb-6"
          >
            Flexible Pricing for Researchers
          </motion.h2>
          <div className="max-w-2xl mx-auto">
            <p className="text-zinc-500 dark:text-zinc-400 text-lg leading-relaxed mb-4">
              Choose the model that fits your depth of analysis. Every new account starts
              with <span className="font-bold underline decoration-2 underline-offset-4" style={{ color: primaryColor, textDecorationColor: primaryColor }}>
                <br />5 free credits</span> to get you started.
            </p>
            <p className="text-sm text-zinc-400 font-medium italic">No credit card required.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              whileInView={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 20 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -8 }}
              className={`relative flex flex-col p-8 rounded-2xl border transition-all duration-300 ${plan.highlight
                ? "bg-white dark:bg-zinc-800 border-[var(--primary)] shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] z-10"
                : "bg-white/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 backdrop-blur-sm"
                }`}
            >
              {plan.highlight && (
                <div
                  className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-white text-xs font-bold uppercase tracking-wider"
                  style={{ backgroundColor: primaryColor }}
                >
                  Most Popular
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-2xl font-bold font-serif mb-2">{plan.name}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{plan.description}</p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-1">
                  <span className="text-zinc-900 dark:text-white text-2xl font-bold">$</span>
                  <span className="text-5xl font-bold text-zinc-900 dark:text-white">{plan.price}</span>
                  <span className="text-zinc-500 text-sm font-medium">/ {plan.credits}</span>
                </div>
                <p className="text-xs text-zinc-400 mt-2">Pay-as-you-go, credits never expire</p>
              </div>

              <ul className="space-y-4 mb-10 flex-1">
                {plan.features.map(feature => (
                  <li key={feature} className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-300">
                    <Check className="h-4 w-4 shrink-0" style={{ color: primaryColor }} />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href="/pricing"
                className={`py-3 px-6 rounded-xl font-bold text-center transition-all ${plan.highlight
                  ? "text-white shadow-lg hover:brightness-110 active:scale-95"
                  : "border-2 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                style={plan.highlight ? { backgroundColor: primaryColor } : {}}
              >
                Get Started
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-8 pt-12 border-t border-zinc-200 dark:border-zinc-800">
          {/* <div className="flex items-center gap-6">
            {/* <div className="flex -space-x-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="w-10 h-10 rounded-full border-2 border-white dark:border-zinc-900 bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex items-center justify-center">
                  <div className="w-full h-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400 font-serif">
                    TD
                  </div>
                </div>
              ))}
            </div>
          <div className="text-sm">
            <span className="font-bold text-zinc-900 dark:text-white block">Join 2,000+ researchers</span>
            <p className="text-zinc-500">grow with our community</p>
          </div>
        </div> */}

          <motion.div
            whileInView={{ opacity: 1, x: 0 }}
            initial={{ opacity: 0, x: 20 }}
            viewport={{ once: true }}
            className="text-center flex flex-col items-center gap-4 "
          >
            <div className="p-3 rounded-xl bg-transparent shadow-sm">
              <Heart className="h-6 w-6" style={{ color: primaryColor }} />
            </div>
            <div className="text-sm">
              <span className="font-bold text-zinc-900 dark:text-white block">Supporting Open Science</span>
              <p className="text-zinc-500">30% of income is donated to <span className="font-bold">arXiv.org</span></p>
            </div>
          </motion.div>
        </div>

        <div className="mt-20 text-center">
          <Link
            href="/pricing#features"
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors inline-flex items-center gap-2 text-sm font-medium group"
          >
            View detailed features and comparison <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </section >
  );
}

export default function Home() {
  return (
    <div className="min-h-screen">
      <ParallaxHero />
      <FeaturesCarousel />
      <ScoreSimulator />
      <PricingCTA />
    </div>
  );
}