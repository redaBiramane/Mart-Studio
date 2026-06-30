// ============================================================
// Mart Studio — TypeScript Type Definitions
// ============================================================

// ---- Step Definitions ----

export interface StepDefinition {
  id: number;
  key: string;
  title: string;
  titleShort: string;
  icon: string;
  description: string;
  questions: string[];
}

// ---- Workshop Session Data ----

export interface Entity {
  id: string;
  name: string;
  definition: string;
  description: string;
  example: string;
  responsible: string;
  type: 'transactional' | 'reference' | 'event' | 'aggregate';
  lifecycle: 'created' | 'evolving' | 'archived';
}

export interface Attribute {
  id: string;
  entityId: string;
  name: string;
  type: string;
  description: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isNaturalKey: boolean;
  isRequired: boolean;
  isSensitive: boolean;
  isHistorized: boolean;
  businessRule?: string;
  foreignKeyRef?: string;
}

export interface Relation {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  sourceEntityName: string;
  targetEntityName: string;
  type: '1:1' | '1:N' | 'N:1' | 'N:N';
  isRequired: boolean;
  description: string;
  isHierarchy: boolean;
}

export interface GranularityInfo {
  observationUnit: string;
  lineRepresents: string;
  detailLevel: string;
  multipleLinesPerObject: boolean;
  temporality: 'daily' | 'monthly' | 'transactional' | 'snapshot' | 'other';
  isHistorized: boolean;
  description: string;
}

export interface KPI {
  id: string;
  name: string;
  formula: string;
  frequency: string;
  aggregationLevels: string[];
  filters: string[];
  analysisAxes: string[];
  description: string;
}

export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  type: 'validation' | 'calculation' | 'constraint' | 'temporal' | 'exception';
  entities: string[];
  expression?: string;
}

export interface DataSource {
  id: string;
  name: string;
  system: string;
  type: 'database' | 'api' | 'file' | 'stream' | 'manual';
  isReliable: boolean;
  isReference: boolean;
  isHistorized: boolean;
  loadFrequency: string;
  entities: string[];
  description: string;
}

export interface QualityRule {
  id: string;
  name: string;
  type: 'uniqueness' | 'completeness' | 'consistency' | 'validity' | 'timeliness';
  columns: string[];
  threshold: number;
  description: string;
  anomalyDetection: string;
}

export interface GovernanceInfo {
  dataOwner: string;
  definitionValidator: string;
  confidentialityLevel: 'public' | 'internal' | 'confidential' | 'restricted';
  gdprConstraints: string;
  isSensitive: boolean;
  retentionPeriod: string;
  description: string;
}

export interface ArchitectureInfo {
  datamartObjects: string[];
  semanticModelObjects: string[];
  reportObjects: string[];
  technicalObjects: string[];
  collibraObjects: string[];
  description: string;
}

export interface MaturityScores {
  businessUnderstanding: number;
  modeling: number;
  documentation: number;
  governance: number;
  dataQuality: number;
  architecture: number;
  dadReadiness: number;
}

// ---- Chat Messages ----

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  step: number;
}

// ---- Session ----

export interface WorkshopSession {
  id: string;
  createdAt: number;
  updatedAt: number;
  currentStep: number;
  status: 'active' | 'completed';
  
  // Step 1: Context
  productName: string;
  businessProblem: string;
  objective: string;
  users: string[];
  domain: string;
  productOwner: string;
  dataSteward: string;
  businessDecision: string;
  frequency: string;
  existingSimilar: string;
  contextSummary: string;
  
  // Step 2: Business Concepts
  entities: Entity[];
  
  // Step 3: Granularity
  granularity: GranularityInfo | null;
  
  // Step 4: Relations
  relations: Relation[];
  
  // Step 5: Attributes
  attributes: Attribute[];
  
  // Step 6: KPIs
  kpis: KPI[];
  
  // Step 7: Business Rules
  businessRules: BusinessRule[];
  
  // Step 8: Data Sources
  dataSources: DataSource[];
  
  // Step 9: Data Quality
  qualityRules: QualityRule[];
  
  // Step 10: Governance
  governance: GovernanceInfo | null;
  
  // Step 11: Architecture
  architecture: ArchitectureInfo | null;
  
  // Step 12: Validation
  maturityScores: MaturityScores | null;
  validationNotes: string[];
  
  // Chat
  messages: ChatMessage[];
}

// ---- LLM Configuration ----

export interface LLMSettings {
  provider: 'openai' | 'google' | 'anthropic' | 'custom';
  apiKey: string;
  model: string;
  customBaseUrl?: string;
}

// ---- Auth / Admin ----

export type UserRole = 'user' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
}

export interface ActivityLog {
  id: number;
  user_id: string | null;
  user_email: string | null;
  action: string;
  detail: string | null;
  created_at: string;
}

export interface AdminProduct {
  id: string;
  owner_email: string | null;
  name: string | null;
  domain: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

// ---- Store ----

export interface WorkshopStore {
  session: WorkshopSession | null;
  sessions: WorkshopSession[];
  llmSettings: LLMSettings;
  isLoading: boolean;
  isSending: boolean;
  currentPage: 'dashboard' | 'workshop' | 'deliverables' | 'admin' | 'docs' | 'supervision';

  // Auth / admin state
  authReady: boolean;
  user: AuthUser | null;
  profile: Profile | null;
  authError: string | null;
  adminProducts: AdminProduct[];
  adminProfiles: Profile[];
  activityLogs: ActivityLog[];

  // Actions
  setCurrentPage: (page: WorkshopStore['currentPage']) => void;
  createSession: () => void;
  loadSession: (id: string) => void;
  setCurrentStep: (step: number) => void;
  addMessage: (message: ChatMessage) => void;
  updateSessionData: (data: Partial<WorkshopSession>) => void;
  updateLLMSettings: (settings: Partial<LLMSettings>) => void;
  completeSession: () => void;
  deleteSession: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setSending: (sending: boolean) => void;

  // Auth actions
  initAuth: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, fullName: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  loadUserSessions: () => Promise<void>;
  loadAdminData: () => Promise<void>;
  logActivity: (action: string, detail?: string) => Promise<void>;
}
