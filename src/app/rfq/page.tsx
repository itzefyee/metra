'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import TechnicalPattern from '@/components/TechnicalPattern';
import BlueprintSketchLayer from '@/components/BlueprintSketchLayer';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import {
  FileText,
  Send,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Upload,
  Building2,
  Mail,
  User,
  Phone,
  Layers,
  ArrowLeft
} from 'lucide-react';

function RFQFormContent() {
  const searchParams = useSearchParams();
  const prefillProduct = searchParams.get('product') || '';
  const prefillId = searchParams.get('id') || '';

  const [formData, setFormData] = useState({
    fullName: '',
    company: '',
    email: '',
    phone: '',
    productName: prefillProduct,
    quantity: '100',
    targetMaterial: 'A36 Structural Steel',
    process: 'CNC Machining',
    certification: 'ISO 9001 + Material Test Report (MTR)',
    targetDate: '',
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedQuoteId, setSubmittedQuoteId] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate submission and quote generation
    setTimeout(() => {
      const generatedId = `RFQ-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
      setSubmittedQuoteId(generatedId);
      setIsSubmitting(false);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      {/* Banner */}
      <section className="relative overflow-hidden pt-28 pb-14" style={{ background: 'var(--hero-blue-gradient)' }}>
        <TechnicalPattern />
        <div className="absolute inset-0 bg-black/40" />
        <BlueprintSketchLayer />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold uppercase tracking-wider mb-4">
            <FileText className="w-4 h-4 text-blue-300" />
            Fast-Track B2B Procurement
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">
            Request For Quote (RFQ)
          </h1>
          <p className="text-sm sm:text-base text-white/80 max-w-2xl">
            Submit your component specifications, CAD drawings, and batch requirements. Receive guaranteed manufacturer pricing and lead times within 4 hours.
          </p>
        </div>
      </section>

      {/* Main Content Area */}
      <section className="py-12 flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        {submittedQuoteId ? (
          /* Success Screen */
          <div className="catalog-glass-container rounded-3xl p-8 sm:p-12 border border-emerald-500/30 text-center max-w-2xl mx-auto shadow-2xl">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">Quote Request Submitted!</h2>
            <p className="text-white/70 text-sm mb-6">
              Thank you, <span className="text-white font-semibold">{formData.fullName}</span>. Your request has been assigned reference ID:
            </p>

            <div className="p-4 bg-slate-800/80 border border-white/10 rounded-xl mb-6 inline-block font-mono text-lg text-emerald-400 font-bold tracking-wider">
              {submittedQuoteId}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left p-4 bg-white/5 rounded-xl border border-white/10 text-xs mb-8">
              <div>
                <span className="text-white/50 block">Product</span>
                <span className="font-semibold text-white">{formData.productName || 'Custom Specification'}</span>
              </div>
              <div>
                <span className="text-white/50 block">Batch Quantity</span>
                <span className="font-semibold text-white">{formData.quantity} units</span>
              </div>
              <div>
                <span className="text-white/50 block">Expected SLA</span>
                <span className="font-semibold text-emerald-400">&lt; 4 Hours</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/catalog"
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                Browse Catalog
              </Link>
              <button
                onClick={() => {
                  setSubmittedQuoteId(null);
                  setFormData((prev) => ({ ...prev, notes: '' }));
                }}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-semibold transition-colors border border-white/10"
              >
                Submit Another RFQ
              </button>
            </div>
          </div>
        ) : (
          /* RFQ Submission Form */
          <form onSubmit={handleSubmit} className="catalog-glass-container rounded-3xl p-6 sm:p-10 border border-white/10 shadow-2xl">
            <div className="space-y-8">
              {/* Section 1: Contact Details */}
              <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 border-b border-white/10 pb-3">
                  <User className="w-5 h-5 text-blue-400" />
                  <span>1. Contact & Procurement Information</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      placeholder="Jane Doe"
                      className="w-full bg-slate-800/90 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-white/30 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1">Company / Organization *</label>
                    <input
                      type="text"
                      required
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      placeholder="Acme Industrial Robotics Inc."
                      className="w-full bg-slate-800/90 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-white/30 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1">Work Email *</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="jane.doe@company.com"
                      className="w-full bg-slate-800/90 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-white/30 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1">Phone Number (Optional)</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+1 (555) 000-0000"
                      className="w-full bg-slate-800/90 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-white/30 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Technical & Part Requirements */}
              <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 border-b border-white/10 pb-3">
                  <Layers className="w-5 h-5 text-indigo-400" />
                  <span>2. Component & Batch Specifications</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm mb-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-white/70 mb-1">Product / Part Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.productName}
                      onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                      placeholder="e.g. M12 Flange Mount or Custom Robotic Bracket"
                      className="w-full bg-slate-800/90 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-white/30 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1">Estimated Quantity *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      className="w-full bg-slate-800/90 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-white/30 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1">Required Material</label>
                    <select
                      value={formData.targetMaterial}
                      onChange={(e) => setFormData({ ...formData, targetMaterial: e.target.value })}
                      className="w-full bg-slate-800/90 border border-white/20 rounded-xl px-3 py-2.5 text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="A36 Structural Steel">A36 Structural Steel</option>
                      <option value="6061-T6 Aluminum">6061-T6 Aluminum</option>
                      <option value="304 Stainless Steel">304 Stainless Steel</option>
                      <option value="316L Marine Stainless">316L Marine Stainless</option>
                      <option value="Brass / Bronze">Brass / Bronze Alloy</option>
                      <option value="Custom Specification">Custom Specification</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1">Manufacturing Process</label>
                    <select
                      value={formData.process}
                      onChange={(e) => setFormData({ ...formData, process: e.target.value })}
                      className="w-full bg-slate-800/90 border border-white/20 rounded-xl px-3 py-2.5 text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="CNC Machining">CNC 3/5-Axis Milling</option>
                      <option value="Sheet Metal & Bending">Laser Cutting & Press Brake</option>
                      <option value="Welding & Structural">AISC/AWS Certified Welding</option>
                      <option value="Metal 3D Printing">DMLS Metal 3D Printing</option>
                      <option value="Standard Catalog Supply">Standard Catalog Fulfillment</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1">Target Delivery Window</label>
                    <select
                      value={formData.targetDate}
                      onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                      className="w-full bg-slate-800/90 border border-white/20 rounded-xl px-3 py-2.5 text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="Standard (2-3 Weeks)">Standard (2 - 3 Weeks)</option>
                      <option value="Expedited (5-7 Days)">Expedited (5 - 7 Days)</option>
                      <option value="Emergency Sprint (&lt; 5 Days)">Emergency Sprint (&lt; 5 Days)</option>
                      <option value="Scheduled Blanket PO">Scheduled Blanket PO</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 3: Notes & Drawing Attachment Guidance */}
              <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 border-b border-white/10 pb-3">
                  <FileText className="w-5 h-5 text-purple-400" />
                  <span>3. Drawing Notes & Technical Tolerances</span>
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1">
                      Critical Tolerances, Surface Finish & Notes
                    </label>
                    <textarea
                      rows={3}
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Specify required surface treatments (e.g. black oxide, anodized, passivation), critical hole tolerances (H7), or special packaging instructions..."
                      className="w-full bg-slate-800/90 border border-white/20 rounded-xl p-4 text-white placeholder-white/30 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>

                  <div className="p-4 bg-purple-950/30 border border-purple-800/30 rounded-xl flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-purple-200">
                      <span className="font-semibold block text-white mb-0.5">Need automated CAD validation?</span>
                      You can pre-analyze your STEP, STL, or 2D PDF drawing using our{' '}
                      <Link href="/cad-analyzer" className="text-purple-300 underline font-semibold hover:text-white">
                        CAD Analyzer
                      </Link>{' '}
                      to check AISC/AWS compliance before finalizing your RFQ.
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/10">
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span>Average engineering review response: &lt; 4 business hours</span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span>Submitting Quote Request...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Submit Request For Quote</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </section>

      <Footer />
    </div>
  );
}

export default function RFQPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <Header />
      <RFQFormContent />
    </Suspense>
  );
}
