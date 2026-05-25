/**
 * Shared API contracts — referenced by both backend (response shapes) and
 * frontend (axios call sites). Pure type definitions; zero runtime code so
 * either project can `import type` from here without bundling anything.
 *
 * Wire it up via TS path aliases:
 *   backend/tsconfig.json    →  "@shared/*": ["../shared/*"]
 *   frontend/tsconfig.app.json → "@shared/*": ["../shared/*"]
 *
 * Then in code:
 *   import type { SessionResponse, UploadResponse } from '@shared/types/api';
 */

// ─── Domain primitives ────────────────────────────────────────────────────────

export type SubscriptionType = 'basic' | 'premium' | 'enterprise';
export type UserRole = 'user' | 'admin' | 'super_admin';
export type FileStatus = 'uploaded' | 'processing' | 'completed' | 'failed';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type TemplateType =
  | 'balanceSheet'
  | 'cashFlow'
  | 'profitLoss'
  | 'profitLossForm2'
  | 'equity';
export type SupportedLocale = 'ru' | 'en' | 'uz';
export type ThemePreference = 'light' | 'dark' | 'system';
export type LocaleApp = 'user' | 'admin';
export type ReportType = 'balance_sheet' | 'cash_flow' | 'profit_loss_form2' | 'equity';

// ─── Envelope ─────────────────────────────────────────────────────────────────

export interface SuccessEnvelope<T> {
  success: true;
  message?: string;
}

export interface ErrorEnvelope {
  success: false;
  error: string;
  message: string;
  details?: unknown;
  field?: string;
  stack?: string;
  requestId?: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface UserPreferences {
  language: SupportedLocale;
  theme: ThemePreference;
  defaultTemplate: string | null;
  notifications: { email: boolean; browser: boolean };
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  picture: string | null;
  role: UserRole;
  subscriptionType: SubscriptionType;
  filesProcessedThisMonth: number;
  filesCompletedThisMonth: number;
}

export interface SessionResponse extends SuccessEnvelope<unknown> {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
}

export interface ProfileResponse extends SuccessEnvelope<unknown> {
  user: SessionUser & {
    monthlyLimit: number;
    canProcessFiles: boolean;
    preferences: UserPreferences;
    lastLoginAt: string;
    createdAt: string;
  };
}

export interface RefreshTokenResponse extends SuccessEnvelope<unknown> {
  accessToken: string;
}

export interface InitiateGoogleLoginResponse extends SuccessEnvelope<unknown> {
  authUrl: string;
}

// ─── 2FA ──────────────────────────────────────────────────────────────────────

export interface TwoFactorStatusResponse extends SuccessEnvelope<unknown> {
  totpEnabled: boolean;
  totpEnabledAt: string | null;
  encryptionConfigured: boolean;
}

export interface TwoFactorSetupResponse extends SuccessEnvelope<unknown> {
  otpauthUrl: string;
  qrDataUrl: string;
  issuer: string;
}

export interface AdminSessionInfo {
  sessionId: string;
  expiresAt: string;
}

export interface TwoFactorConfirmResponse extends SuccessEnvelope<unknown> {
  totpEnabled: true;
  backupCodes: string[];
  adminSession: AdminSessionInfo;
}

export interface TwoFactorVerifyResponse extends SuccessEnvelope<unknown> {
  adminSession: AdminSessionInfo;
  method: 'totp' | 'backup_code';
  backupCodesRemaining: number;
}

// ─── Files ────────────────────────────────────────────────────────────────────

export interface FileWarning {
  message?: string;
  row?: number;
  column?: string;
  severity?: 'info' | 'warning' | 'error';
}

export interface FileSummary {
  id: string;
  originalName: string;
  templateType: TemplateType;
  status: FileStatus;
  fileSize: number;
  createdAt: string;
  completedAt: string | null;
  jobId: string;
  transformations: number;
  changes: number;
}

export interface UploadResponse extends SuccessEnvelope<unknown> {
  jobId: string;
  fileId: string;
  templateType: TemplateType;
}

export interface FileHistoryResponse extends SuccessEnvelope<unknown> {
  files: FileSummary[];
  totalCount: number;
  hasMore: boolean;
}

export interface JobStatusResponse extends SuccessEnvelope<unknown> {
  job: {
    id: string;
    fileId?: string;
    fileName?: string;
    templateType: TemplateType;
    status: JobStatus;
    progress: number;
    error?: { message?: string; name?: string; details?: unknown };
    result?: unknown;
    createdAt: string;
    completedAt: string | null;
    retryCount: number;
  };
}

export interface FileDetailsResponse extends SuccessEnvelope<unknown> {
  file: FileSummary & { warnings: FileWarning[]; hasProcessedFile: boolean };
}

export interface TransformationResponse extends SuccessEnvelope<unknown> {
  transformation: Record<string, unknown>;
}

export interface SourceWorkbookResponse extends SuccessEnvelope<unknown> {
  workbook: Record<string, unknown>;
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface AdminMeResponse extends SuccessEnvelope<unknown> {
  admin: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    totpEnabled: boolean;
  };
}

export interface AdminStatsResponse extends SuccessEnvelope<unknown> {
  stats: {
    totalUsers: number;
    totalFiles: number;
    usersByRole: Array<{ _id: UserRole; count: number }>;
    usersByActive: Array<{ _id: boolean; count: number }>;
    filesByStatus: Array<{ _id: FileStatus; count: number }>;
    filesByTemplate: Array<{ _id: TemplateType; count: number }>;
    filesLast7Days: Array<{ _id: string; count: number }>;
    templateTypes: readonly TemplateType[];
  };
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface AdminUsersListResponse extends SuccessEnvelope<unknown> {
  users: Array<SessionUser & { isActive: boolean; createdAt: string }>;
  pagination: Pagination;
}

export interface WhitelistEntry {
  _id: string;
  email: string;
  addedBy: { _id: string; email: string; name: string } | null;
  note: string;
  createdAt: string;
}

export interface WhitelistResponse extends SuccessEnvelope<unknown> {
  enabled: boolean;
  entries: WhitelistEntry[];
}

// ─── Locales ──────────────────────────────────────────────────────────────────

export interface LocaleBundleResponse extends SuccessEnvelope<unknown> {
  version: number;
  bundle: Record<string, unknown>;
}

export interface LocaleVersionsResponse extends SuccessEnvelope<unknown> {
  versions: Record<LocaleApp, number>;
}

export interface LocaleKey {
  _id: string;
  key: string;
  namespace: string | null;
  app: LocaleApp;
  values: { ru: string | null; en: string | null; uz: string | null };
  source: 'file' | 'db';
  notes: string | null;
  updatedBy?: { _id: string; email: string; name: string } | null;
}

export interface LocaleKeysListResponse extends SuccessEnvelope<unknown> {
  keys: LocaleKey[];
  pagination: Pagination;
}

// ─── Mappings ────────────────────────────────────────────────────────────────

export type MappingSetStatus = 'draft' | 'published' | 'archived';

export interface MappingSetSummary {
  _id: string;
  reportType: ReportType;
  version: number;
  status: MappingSetStatus;
  assignedUsers: Array<{ _id: string; email: string; name: string }>;
  label: string;
  notes: string;
  publishedAt: string | null;
  publishedBy: { _id: string; email: string; name: string } | null;
  createdBy: { _id: string; email: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
}

export interface MappingSetsListResponse extends SuccessEnvelope<unknown> {
  sets: MappingSetSummary[];
  grouped: Record<ReportType, MappingSetSummary[]>;
}
