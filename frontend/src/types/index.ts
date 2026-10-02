export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type AnalysisStatus = 'uploaded' | 'parsing' | 'parsed' | 'analyzing' | 'completed' | 'failed';

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error: null | {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    request_id?: string;
  };
}

export interface ContractFile {
  id: string;
  originalFilename: string;
  fileType: 'PDF' | 'DOCX' | 'TXT';
  fileSizeBytes: number;
  status: string;
  pageCount?: number | null;
  wordCount?: number | null;
  parseWarnings: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RiskFinding {
  title: string;
  risk_level: RiskLevel;
  description: string;
}

export interface SuspiciousContent {
  text: string;
  reason: string;
  page_number: number;
}

export interface Clause {
  id: string;
  title?: string;
  clauseIndex: number;
  clauseType: string;
  heading: string;
  text: string;
  risk?: string;
  riskScore: number;
  riskLevel: RiskLevel;
  riskReasons: string[];
  reason?: string;
  legalReasoning: string;
  businessImpact: string;
  saferAlternative: string;
  flags: string[];
  confidence: number;
}

export interface Analysis {
  analysisId?: string;
  contractId?: string;
  status: AnalysisStatus;
  contractRiskScore: number;
  riskLevel: RiskLevel;
  summary: {
    executiveSummary: string;
    purpose?: string | null;
    partiesInvolved: string[];
    duration?: string | null;
    financialObligations: string[];
    terminationConditions: string[];
    renewal?: string | null;
    importantDates: string[];
    deliverables: string[];
  };
  importantPoints: Array<{ category: string; text: string; importance: string }>;
  fraudWarnings: Array<{ type: string; text: string; whySuspicious: string; severity: string; confidence: number }>;
  clauses: Clause[];
  completedAt?: string;
}

export interface FraudAlert {
  id: string;
  title: string;
  risk_level: RiskLevel;
  why_detected: string;
  business_impact: string;
  recommended_action: string;
}

export interface Pinpoint {
  title: string;
  value: string;
  risk_level: RiskLevel;
}

export interface User {
  id: string;
  email: string;
  fullName?: string | null;
  role: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  user: User;
}

export interface RewriteClauseResponse {
  originalClause: string;
  saferAlternative: string;
  reasoning: string;
}

