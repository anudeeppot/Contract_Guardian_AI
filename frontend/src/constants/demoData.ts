import type { Analysis, Clause, ContractFile, FraudAlert, Pinpoint } from '../types';

export const recentFiles: ContractFile[] = [
  {
    id: 'ctr_1024',
    originalFilename: 'vendor-master-services.pdf',
    fileType: 'PDF',
    fileSizeBytes: 1842102,
    status: 'completed',
    parseWarnings: [],
    createdAt: '2026-08-07T10:30:00Z',
    updatedAt: '2026-08-07T10:30:00Z',
  },
  {
    id: 'ctr_1025',
    originalFilename: 'employment-agreement.docx',
    fileType: 'DOCX',
    fileSizeBytes: 742102,
    status: 'analyzing',
    parseWarnings: [],
    createdAt: '2026-08-06T17:12:00Z',
    updatedAt: '2026-08-06T17:12:00Z',
  },
  {
    id: 'ctr_1026',
    originalFilename: 'enterprise-nda.pdf',
    fileType: 'PDF',
    fileSizeBytes: 980420,
    status: 'uploaded',
    parseWarnings: [],
    createdAt: '2026-08-05T09:05:00Z',
    updatedAt: '2026-08-05T09:05:00Z',
  },
];

export const sampleAnalysis: Analysis = {
  analysisId: 'analysis_9001',
  contractId: 'ctr_1024',
  status: 'completed',
  contractRiskScore: 78,
  riskLevel: 'high',
  summary: {
    executiveSummary:
      'This vendor agreement is commercially useful but materially one-sided. It includes broad renewal language, uncapped liability exposure for the customer, unclear fee adjustments, and vague acceptance criteria for deliverables.',
    partiesInvolved: ['Acme Corp', 'VendorMax Inc.'],
    duration: '12 months',
    financialObligations: ['Net 15 payment terms', 'Late fee penalties'],
    terminationConditions: ['Vendor termination for convenience only'],
    importantDates: ['Jan 1, 2026', 'Dec 31, 2026'],
    deliverables: ['Managed platform services'],
  },
  importantPoints: [
    {
      category: 'Renewal',
      importance: 'high',
      text: 'Renewal occurs unless notice is sent within a short window that may be easy to miss.',
    },
    {
      category: 'Pricing',
      importance: 'critical',
      text: 'The vendor may change fees without a defined cap, notice period, or approval workflow.',
    },
    {
      category: 'Indemnity',
      importance: 'high',
      text: 'Customer indemnity obligations are broader than vendor obligations.',
    },
  ],
  fraudWarnings: [
    {
      type: 'Undefined payment terms',
      text: 'Fees may be adjusted at vendor discretion after execution.',
      whySuspicious: 'Undefined pricing increases post-signature',
      severity: 'critical',
      confidence: 94,
    },
  ],
  clauses: [],
  completedAt: '2026-08-07T10:34:00Z',
};

export const fraudAlerts: FraudAlert[] = [
  {
    id: 'hidden-fees',
    title: 'Hidden fees',
    risk_level: 'critical',
    why_detected: 'The fee clause allows discretionary post-signature adjustments without a cap.',
    business_impact: 'Budget owners may face unexpected spend, procurement exceptions, and renewal disputes.',
    recommended_action: 'Require fixed pricing, written approval for changes, and a maximum annual increase.',
  },
  {
    id: 'automatic-renewal',
    title: 'Automatic renewal',
    risk_level: 'high',
    why_detected: 'The renewal clause requires notice in a narrow 15-day cancellation window.',
    business_impact: 'The business may be locked into another term before stakeholders can evaluate vendor performance.',
    recommended_action: 'Change renewal to opt-in or require at least 60 days of advance reminder notice.',
  },
];

export const pinpoints: Pinpoint[] = [
  { title: 'Payment Terms', value: 'Net 15 with discretionary fee changes', risk_level: 'critical' },
  { title: 'Termination', value: 'For convenience by vendor only', risk_level: 'high' },
  { title: 'Renewal', value: 'Auto-renews for 12 months', risk_level: 'high' },
];

export const clauses: Clause[] = [
  {
    id: 'clause_1',
    clauseIndex: 1,
    clauseType: 'Payment Terms',
    heading: 'Fees and Payment',
    text: 'Customer shall pay all invoices within fifteen days. Vendor may adjust fees at its discretion after execution.',
    riskScore: 92,
    riskLevel: 'critical',
    riskReasons: ['Uncapped fee changes', 'Short payment window', 'No approval workflow'],
    legalReasoning: 'Allows unilateral fee increases without customer consent.',
    businessImpact: 'Unpredictable software expenditure and budget overruns.',
    saferAlternative:
      'Vendor may adjust fees only once per renewal term with at least sixty days written notice, capped at five percent annually, and subject to customer written approval.',
    flags: ['unilateral_pricing'],
    confidence: 94,
  },
  {
    id: 'clause_2',
    clauseIndex: 2,
    clauseType: 'Renewal',
    heading: 'Term and Renewal',
    text: 'This Agreement automatically renews unless Customer provides notice exactly fifteen days before expiration.',
    riskScore: 81,
    riskLevel: 'high',
    riskReasons: ['Narrow cancellation window', 'No renewal reminder', 'Automatic lock-in'],
    legalReasoning: 'Extremely restrictive notice requirement that creates accidental lock-in.',
    businessImpact: 'Forces continuation of unwanted contracts.',
    saferAlternative:
      'This Agreement renews only by mutual written agreement or after vendor provides at least sixty days advance renewal notice and customer does not opt out.',
    flags: ['automatic_renewal'],
    confidence: 89,
  },
];
