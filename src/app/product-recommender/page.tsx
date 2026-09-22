'use client';

import React, { useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import TechnicalPattern from '@/components/TechnicalPattern';
import BlueprintSketchLayer from '@/components/BlueprintSketchLayer';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useProducts, Product } from '@/hooks';
import {
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
  ArrowRight,
  SlidersHorizontal,
  Zap,
  Layers,
  ShieldCheck,
  FileText
} from 'lucide-react';

function RecommenderContent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('category') || 'all';

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedMaterial, setSelectedMaterial] = useState('all');
  const [loadRequirement, setLoadRequirement] = useState('all');
  const [environment, setEnvironment] = useState('all');

  const { data, isLoading } = useProducts({ limit: 50 });
  const allProducts = data?.products || [];

  // Material families for filter
  const materialOptions = [
    { value: 'all', label: 'All Materials' },
    { value: 'steel', label: 'Structural Steel' },
    { value: 'aluminum', label: 'Aluminum 6061/7075' },
    { value: 'stainless', label: 'Stainless Steel (304/316)' },
    { value: 'titanium', label: 'Titanium / Alloys' },
  ];

  // Category options
  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    { value: 'structural', label: 'Structural & Framing' },
    { value: 'robotic', label: 'Robotic & Motion' },
    { value: 'fasteners', label: 'Fasteners & Hardware' },
    { value: 'custom', label: 'Custom CNC & Castings' },
  ];

  // Scored and filtered recommendations
  const recommendations = useMemo(() => {
    if (!allProducts.length) return [];

    return allProducts.map((product) => {
      let score = 70; // baseline compatibility
      const reasons: string[] = [];

      // Category matching
      if (selectedCategory !== 'all') {
        if (product.category?.toLowerCase() === selectedCategory.toLowerCase()) {
          score += 15;
          reasons.push('Direct category match');
        } else {
          score -= 20;
        }
      }

      // Material matching
      const prodMaterial = (product.material || product.materialFamily || '').toLowerCase();
      if (selectedMaterial !== 'all') {
        if (prodMaterial.includes(selectedMaterial.toLowerCase())) {
          score += 15;
          reasons.push(`Engineered for ${selectedMaterial} applications`);
        } else {
          score -= 10;
        }
      }

      // Query search
      if (query.trim()) {
        const q = query.toLowerCase();
        const searchTarget = `${product.name} ${product.description || ''} ${product.category || ''} ${prodMaterial}`.toLowerCase();
        if (searchTarget.includes(q)) {
          score += 15;
          reasons.push('Matches keyword criteria');
        } else {
          score -= 15;
        }
      }

      // Stock bonus
      if (product.inStock) {
        score += 5;
        reasons.push('Available in stock for immediate dispatch');
      }

      // Environment rating
      if (environment === 'corrosive' && (prodMaterial.includes('stainless') || prodMaterial.includes('titanium'))) {
        score += 10;
        reasons.push('Corrosion-resistant alloy suitable for harsh environments');
      }

      // Normalize score between 40% and 99%
      const finalScore = Math.max(45, Math.min(99, score));

      return {
        product,
        score: finalScore,
        reasons: reasons.length > 0 ? reasons : ['General mechanical compatibility'],
      };
    })
    .filter((item) => (selectedCategory === 'all' || item.product.category?.toLowerCase() === selectedCategory.toLowerCase()) && item.score >= 50)
    .sort((a, b) => b.score - a.score);
  }, [allProducts, selectedCategory, selectedMaterial, query, environment]);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      {/* Hero Banner */}
      <section className="relative overflow-hidden pt-28 pb-16" style={{ background: 'var(--hero-blue-gradient)' }}>
        <TechnicalPattern />
        <div className="absolute inset-0 bg-black/40" />
        <BlueprintSketchLayer />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-xs font-semibold uppercase tracking-wider mb-6">
            <Sparkles className="w-4 h-4 text-purple-300" />
            AI Specification & Component Matching
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
            Industrial Product Recommender
          </h1>
          <p className="text-lg text-white/80 max-w-3xl leading-relaxed">
            Enter your structural requirements, load tolerances, and material constraints. Our engineering engine matches optimal catalog components with compliance scores and standard alternatives.
          </p>

          {/* Search Bar */}
          <div className="mt-8 max-w-2xl relative">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search components by spec, keyword, or dimensions (e.g. M12 high-strength bolt, 40mm flange)..."
                className="w-full pl-12 pr-4 py-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent text-sm"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-xs px-2 py-1 bg-white/10 rounded"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Filter & Results */}
      <section className="py-12 flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        {/* Filter Controls */}
        <div className="catalog-glass-container rounded-2xl p-6 mb-8 text-white border border-white/10">
          <div className="flex items-center gap-2 mb-4 font-semibold text-sm text-purple-300">
            <SlidersHorizontal className="w-4 h-4" />
            <span>Refine Engineering Criteria</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            {/* Category Filter */}
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">Component Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-slate-800/90 border border-white/20 rounded-lg px-3 py-2 text-white text-xs focus:ring-2 focus:ring-purple-400 focus:outline-none"
              >
                {categoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Material Filter */}
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">Target Material Family</label>
              <select
                value={selectedMaterial}
                onChange={(e) => setSelectedMaterial(e.target.value)}
                className="w-full bg-slate-800/90 border border-white/20 rounded-lg px-3 py-2 text-white text-xs focus:ring-2 focus:ring-purple-400 focus:outline-none"
              >
                {materialOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Load Capacity */}
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">Operating Load</label>
              <select
                value={loadRequirement}
                onChange={(e) => setLoadRequirement(e.target.value)}
                className="w-full bg-slate-800/90 border border-white/20 rounded-lg px-3 py-2 text-white text-xs focus:ring-2 focus:ring-purple-400 focus:outline-none"
              >
                <option value="all">Any Load Rating</option>
                <option value="light">Light Duty (&lt; 5 kN)</option>
                <option value="medium">Medium Duty (5 - 25 kN)</option>
                <option value="heavy">Heavy Structural (&gt; 25 kN)</option>
              </select>
            </div>

            {/* Environment */}
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">Operating Environment</label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                className="w-full bg-slate-800/90 border border-white/20 rounded-lg px-3 py-2 text-white text-xs focus:ring-2 focus:ring-purple-400 focus:outline-none"
              >
                <option value="all">Standard Workshop / Indoor</option>
                <option value="corrosive">Corrosive / Marine / Chemical</option>
                <option value="outdoor">Outdoor / Weather-Exposed</option>
                <option value="precision">Cleanroom / High-Precision</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Recommended Components</h2>
            <p className="text-xs text-white/60">
              Showing {recommendations.length} matched components sorted by AI compatibility score
            </p>
          </div>
          {(selectedCategory !== 'all' || selectedMaterial !== 'all' || query) && (
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSelectedMaterial('all');
                setLoadRequirement('all');
                setEnvironment('all');
                setQuery('');
              }}
              className="text-xs text-purple-400 hover:text-purple-300 underline"
            >
              Reset all filters
            </button>
          )}
        </div>

        {/* Product Cards List */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-sm text-white/60">Analyzing component specifications against catalog...</p>
          </div>
        ) : recommendations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendations.map(({ product, score, reasons }) => (
              <div
                key={product.id || product._id}
                className="catalog-glass-container rounded-2xl overflow-hidden border border-white/10 flex flex-col justify-between hover:border-purple-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/10 group"
              >
                <div>
                  {/* Card Image Banner */}
                  <div className="h-44 bg-slate-800/80 relative overflow-hidden flex items-center justify-center">
                    {product.images && product.images[0] ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-white/40">
                        <Layers className="w-10 h-10 mb-2 opacity-50" />
                        <span className="text-xs">Technical Component</span>
                      </div>
                    )}

                    {/* Compatibility Badge */}
                    <div className="absolute top-3 right-3 bg-slate-900/90 backdrop-blur-md border border-purple-500/40 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg">
                      <Zap className="w-3.5 h-3.5 text-purple-400 fill-purple-400" />
                      <span className="text-xs font-bold text-white">{score}% Match</span>
                    </div>

                    {/* Stock Status Badge */}
                    <div className="absolute bottom-3 left-3">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          product.inStock
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {product.inStock ? 'In Stock' : 'Made to Order'}
                      </span>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-5 space-y-3">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-purple-400 font-semibold">
                        {product.category || 'General'}
                      </span>
                      <h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors">
                        {product.name}
                      </h3>
                      {product.material && (
                        <p className="text-xs text-white/60 mt-0.5">Material: {product.material}</p>
                      )}
                    </div>

                    <p className="text-xs text-white/70 line-clamp-2">
                      {product.description || product.technicalDetails || 'Engineered industrial component.'}
                    </p>

                    {/* Match Reasoning */}
                    <div className="p-2.5 rounded-lg bg-purple-950/40 border border-purple-800/30 text-[11px] text-purple-200 space-y-1">
                      <span className="font-semibold text-purple-300 block">AI Specification Fit:</span>
                      <ul className="space-y-0.5">
                        {reasons.slice(0, 2).map((r, i) => (
                          <li key={i} className="flex items-center gap-1.5 text-white/80">
                            <CheckCircle2 className="w-3 h-3 text-purple-400 flex-shrink-0" />
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="p-5 pt-0 border-t border-white/5 mt-4 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] text-white/50 block">Unit Price</span>
                    <span className="text-lg font-bold text-white">${product.price.toFixed(2)}</span>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href={`/rfq?product=${encodeURIComponent(product.name)}&id=${encodeURIComponent(product.id || product._id)}`}
                      className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md shadow-purple-600/20"
                    >
                      <span>Request Quote</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 catalog-glass-container rounded-2xl border border-white/10 p-8">
            <Layers className="w-12 h-12 text-white/40 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white mb-1">No exact component matches found</h3>
            <p className="text-xs text-white/60 max-w-md mx-auto mb-4">
              Try broadening your category or material filters, or submit a custom Request For Quote (RFQ) with your CAD specs.
            </p>
            <Link
              href="/rfq"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>Submit Custom RFQ</span>
            </Link>
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}

export default function ProductRecommenderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <Header />
      <RecommenderContent />
    </Suspense>
  );
}
