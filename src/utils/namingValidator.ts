export interface ValidationResult {
  isValid: boolean;
  issues: string[];
}

export interface NamingConvention {
  pattern: RegExp;
  description: string;
  examples: string[];
}

export const KAFKA_NAMING_CONVENTIONS: NamingConvention[] = [
  {
    pattern: /^[a-z0-9._-]+$/,
    description: 'Must contain only lowercase letters, numbers, dots, underscores, and hyphens',
    examples: ['user.events.v1', 'payment-processing', 'analytics_data']
  },
  {
    pattern: /^(?!.*\.\.)/,
    description: 'Cannot have consecutive dots',
    examples: ['valid.topic.name']
  },
  {
    pattern: /^(?!\.)(?!.*\.$)/,
    description: 'Cannot start or end with a dot',
    examples: ['valid.topic', 'another.valid.topic']
  },
  {
    pattern: /^.{1,255}$/,
    description: 'Must be between 1 and 255 characters',
    examples: ['short', 'medium.length.topic.name']
  }
];

const RECOMMENDED_PATTERNS = {
  envPrefix: /^(dev|qa|staging|prod)\./,
  domainBased: /^[a-z]+\.[a-z]+\.[a-z0-9_-]+/,
  versioned: /\.v\d+$/
};

export function validateTopicName(topicName: string): ValidationResult {
  const issues: string[] = [];

  if (!topicName || topicName.trim() === '') {
    return {
      isValid: false,
      issues: ['Topic name is required']
    };
  }

  const trimmedName = topicName.trim();

  for (const convention of KAFKA_NAMING_CONVENTIONS) {
    if (!convention.pattern.test(trimmedName)) {
      issues.push(convention.description);
    }
  }

  if (trimmedName.length > 255) {
    issues.push('Topic name exceeds 255 characters');
  }

  if (/[A-Z]/.test(trimmedName)) {
    issues.push('Contains uppercase letters (should be lowercase)');
  }

  if (/\s/.test(trimmedName)) {
    issues.push('Contains whitespace');
  }

  if (/[^a-z0-9._-]/.test(trimmedName)) {
    issues.push('Contains invalid characters (only lowercase letters, numbers, dots, underscores, and hyphens allowed)');
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export function getRecommendations(topicName: string): string[] {
  const recommendations: string[] = [];

  if (!RECOMMENDED_PATTERNS.envPrefix.test(topicName)) {
    recommendations.push('Consider prefixing with environment (dev., qa., staging., prod.)');
  }

  if (!RECOMMENDED_PATTERNS.domainBased.test(topicName)) {
    recommendations.push('Consider using domain-based naming: <domain>.<subdomain>.<entity>');
  }

  if (!RECOMMENDED_PATTERNS.versioned.test(topicName)) {
    recommendations.push('Consider adding version suffix (e.g., .v1, .v2)');
  }

  const parts = topicName.split('.');
  if (parts.length < 3) {
    recommendations.push('Consider using at least 3 segments for better organization (e.g., domain.subdomain.entity)');
  }

  return recommendations;
}

export function suggestCorrection(topicName: string): string {
  let corrected = topicName.trim();

  corrected = corrected.toLowerCase();
  corrected = corrected.replace(/\s+/g, '-');
  corrected = corrected.replace(/[^a-z0-9._-]/g, '');
  corrected = corrected.replace(/\.{2,}/g, '.');
  corrected = corrected.replace(/^\.+|\.+$/g, '');
  corrected = corrected.substring(0, 255);

  return corrected;
}
