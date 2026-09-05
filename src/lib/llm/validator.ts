import type { LLMRecommendation } from './types.ts';
import type { RecoveryAction, RecoveryClassification, RiskLevel } from '../recovery/types.ts';

const VALID_CLASSIFICATIONS: Set<RecoveryClassification> = new Set([
  'recoverable',
  'unlikely_recoverable',
  'requires_escalation',
]);

const VALID_ACTIONS: Set<RecoveryAction> = new Set([
  'retry_payment',
  'contact_customer',
  'request_payment_method_update',
  'escalate_to_human',
  'do_nothing',
]);

const VALID_RISK_LEVELS: Set<RiskLevel> = new Set(['low', 'medium', 'high']);

export interface ValidationResult {
  valid: boolean;
  recommendation?: LLMRecommendation;
  error?: string;
}

/**
 * Validates untrusted LLM output string or object against RecoverAI's strict schema.
 * Rejects arbitrary actions, out-of-bound confidence, or missing required fields.
 */
export function validateLLMOutput(rawInput: unknown): ValidationResult {
  if (!rawInput) {
    return { valid: false, error: 'Empty or null LLM response received' };
  }

  let parsed: unknown = rawInput;

  // If string, parse JSON (and strip markdown code fences if model enclosed it)
  if (typeof rawInput === 'string') {
    let text = rawInput.trim();
    if (text.startsWith('```json')) {
      text = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    } else if (text.startsWith('```')) {
      text = text.replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
    }

    try {
      parsed = JSON.parse(text);
    } catch {
      return { valid: false, error: 'Malformed JSON output: unable to parse response' };
    }
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { valid: false, error: 'LLM output must be a JSON object' };
  }

  const obj = parsed as Record<string, unknown>;

  // 1. Validate classification
  if (typeof obj.classification !== 'string' || !VALID_CLASSIFICATIONS.has(obj.classification as RecoveryClassification)) {
    return {
      valid: false,
      error: `Invalid classification: '${obj.classification}'. Must be one of: ${Array.from(VALID_CLASSIFICATIONS).join(', ')}`,
    };
  }

  // 2. Validate recommended_action
  const actionField = obj.recommended_action || obj.action;
  if (typeof actionField !== 'string' || !VALID_ACTIONS.has(actionField as RecoveryAction)) {
    return {
      valid: false,
      error: `Invalid action: '${actionField}'. Must be one of: ${Array.from(VALID_ACTIONS).join(', ')}`,
    };
  }

  // 3. Validate confidence
  if (typeof obj.confidence !== 'number' || isNaN(obj.confidence)) {
    return { valid: false, error: 'Confidence must be a valid number' };
  }
  if (obj.confidence < 0.0 || obj.confidence > 1.0) {
    return {
      valid: false,
      error: `Confidence (${obj.confidence}) is out of bounds; must be between 0.0 and 1.0`,
    };
  }

  // 4. Validate risk_level
  if (typeof obj.risk_level !== 'string' || !VALID_RISK_LEVELS.has(obj.risk_level as RiskLevel)) {
    return {
      valid: false,
      error: `Invalid risk_level: '${obj.risk_level}'. Must be one of: ${Array.from(VALID_RISK_LEVELS).join(', ')}`,
    };
  }

  // 5. Validate diagnosis & reason string presence
  if (typeof obj.diagnosis !== 'string' || obj.diagnosis.trim().length === 0) {
    return { valid: false, error: 'Missing or empty diagnosis string' };
  }

  if (typeof obj.reason !== 'string' || obj.reason.trim().length === 0) {
    return { valid: false, error: 'Missing or empty reason explanation' };
  }

  const recommendation: LLMRecommendation = {
    classification: obj.classification as RecoveryClassification,
    diagnosis: obj.diagnosis.trim(),
    recommended_action: actionField as RecoveryAction,
    confidence: Math.round(obj.confidence * 100) / 100,
    reason: obj.reason.trim(),
    risk_level: obj.risk_level as RiskLevel,
  };

  return {
    valid: true,
    recommendation,
  };
}
