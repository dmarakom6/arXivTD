"use client";

import { motion } from "framer-motion";

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold font-serif text-[#8B1538] mb-8">Terms of Service & Privacy Policy</h1>
        
        <div className="prose dark:prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">Terms of Service</h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
              By using ArXivTD, you agree to these terms. ArXivTD provides academic paper analysis 
              services including citation validation, code provenance checking, AI detection, and 
              trust scoring.
            </p>
            <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-400 space-y-2">
              <li>You must provide accurate information when registering</li>
              <li>You are responsible for maintaining the security of your API keys</li>
              <li>You agree not to use the service for any illegal purposes</li>
              <li>You must be at least 18 years old to use this service</li>
              <li>We reserve the right to suspend accounts that violate these terms</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">Privacy Policy</h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
              ArXivTD is committed to protecting your privacy. This policy explains what data we collect 
              and how we use it.
            </p>

            <h3 className="text-lg font-semibold mb-2">Data We Collect</h3>
            <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-400 space-y-2 mb-4">
              <li><strong>Account Information:</strong> Email address, account creation date</li>
              <li><strong>API Usage:</strong> Scan history, credit usage, API key activity</li>
              <li><strong>Payment Information:</strong> Processed through Stripe - we do not store card details</li>
            </ul>

            <h3 className="text-lg font-semibold mb-2">How We Use Your Data</h3>
            <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-400 space-y-2 mb-4">
              <li>To provide our paper analysis services</li>
              <li>To process payments and manage credits</li>
              <li>To communicate with you about your account</li>
              <li>To improve our services based on usage patterns</li>
            </ul>

            <h3 className="text-lg font-semibold mb-2">Data We Do Not Collect</h3>
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
              We do not store the content of papers you scan. We only process them to generate 
              analysis results which are returned to you.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">Third-Party Services</h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
              ArXivTD uses the following third-party services for paper analysis:
            </p>
            <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-400 space-y-2">
              <li><strong>Semantic Scholar:</strong> For citation validation and paper metadata</li>
              <li><strong>GitHub:</strong> For code provenance and licensing verification</li>
              <li><strong>Google (Gemini):</strong> For AI text analysis</li>
              <li><strong>Anthropic (Claude):</strong> For advanced analysis (optional)</li>
              <li><strong>arXiv:</strong> Source of paper metadata and PDFs</li>
              <li><strong>Stripe:</strong> For payment processing</li>
            </ul>
            <p className="text-zinc-600 dark:text-zinc-400 mt-4">
              These services may process data according to their own privacy policies.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">Data Retention</h2>
            <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-400 space-y-2">
              <li>Account data is retained until you delete your account</li>
              <li>Scan history is kept for 30 days</li>
              <li>API key usage logs are kept for 90 days</li>
              <li>Payment records are retained for 7 years (required by law)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">Your Rights</h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
              Under GDPR and other privacy regulations, you have the right to:
            </p>
            <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-400 space-y-2">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Export your data in a machine-readable format</li>
              <li>Object to processing of your data</li>
            </ul>
            <p className="text-zinc-600 dark:text-zinc-400 mt-4">
              To exercise these rights, contact us at support@arxivtd.com
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-4">Contact</h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              For questions about these terms or our privacy practices, contact us at{" "}
              <a href="mailto:support@arxivtd.com" className="text-[#8B1538] hover:underline">
                support@arxivtd.com
              </a>
            </p>
            <p className="text-sm text-zinc-500 mt-4">
              Last updated: May 2026
            </p>
          </section>
        </div>
      </motion.div>
    </div>
  );
}