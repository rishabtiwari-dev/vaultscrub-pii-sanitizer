/** The 6 built-in, mathematically/structurally validated PII detectors. */
export type BuiltInEntityType =
  | 'EMAIL'
  | 'PHONE'
  | 'IP_ADDRESS'
  | 'PAN'
  | 'AADHAAR'
  | 'CREDIT_CARD';

/** All entity types, including user-supplied custom sensitive terms. */
export type EntityType = BuiltInEntityType | 'CUSTOM';

export const ALL_ENTITY_TYPES: readonly BuiltInEntityType[] = [
  'CREDIT_CARD',
  'EMAIL',
  'AADHAAR',
  'IP_ADDRESS',
  'PAN',
  'PHONE',
] as const;

export type RedactionMode = 'FULL' | 'PARTIAL' | 'PSEUDONYM';

export type FullMaskStyle = 'GENERIC' | 'TYPED';

export interface EntityMetadata {
  cardNetwork?: string;
  panHolderType?: string;
  ipVersion?: 'IPv4' | 'IPv6';
  verhoeffValid?: boolean;
  luhnValid?: boolean;
  phoneRegion?: 'IN' | 'INTL';
  [key: string]: string | number | boolean | undefined;
}

export interface DetectedEntity {
  start: number;
  end: number;
  value: string;
  normalizedValue: string;
  type: EntityType;
  metadata: EntityMetadata;
  validationBadge: string;
  whitelisted?: boolean;
  replacement?: string;
}

export interface RejectedCandidate {
  start: number;
  end: number;
  value: string;
  suspectedType: BuiltInEntityType;
  reason: string;
}

export interface RedactionOptions {
  mode: RedactionMode;
  enabledTypes?:
    | EntityType[]
    | Set<EntityType>
    | Partial<Record<EntityType, boolean>>;
  excludedSpanKeys?: Set<string> | string[];
  strictVerhoeff?: boolean;
  strictPan?: boolean;
  fullMaskStyle?: FullMaskStyle;
  /**
   * Optional user-supplied sensitive terms / codenames (array or a
   * comma-separated string). Matched case-insensitively on word boundaries
   * and always yield to higher-priority built-in PII spans.
   */
  customTerms?: readonly string[] | string;
}

/**
 * Per-type redaction counts. `CUSTOM` is only present when custom terms were
 * supplied, keeping the built-in 6-key shape stable for existing consumers.
 */
export type EntityCounts = Record<BuiltInEntityType, number> & {
  CUSTOM?: number;
};

export interface SanitizationResult {
  sanitizedText: string;
  entities: DetectedEntity[];
  rejectedCandidates: RejectedCandidate[];
  countsByType: EntityCounts;
  pseudonymMap: Record<string, string>;
  processingTimeMs: number;
}

/** Builds the canonical span-exclusion key (`start:end:type`) used for whitelisting. */
export function makeSpanKey(
  entity: Pick<DetectedEntity, 'start' | 'end' | 'type'>
): string {
  return `${entity.start}:${entity.end}:${entity.type}`;
}
