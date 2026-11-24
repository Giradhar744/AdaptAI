/**
 * AdaptAI Student Learning Batch Naming Utilities
 * 
 * Replaces age-based labels (7-10, 11-15, 15-20/16-20) with empowering
 * learning batch names (Batch Alpha, Batch Beta, Batch Gamma) in all student-facing views
 * to ensure neurodivergent students are never discouraged by numerical age labels.
 */

export const STUDENT_GROUP_NAMES = {
  ALPHA: 'Batch Alpha',
  BETA: 'Batch Beta',
  GAMMA: 'Batch Gamma',
} as const;

/**
 * Returns the student-friendly batch name (Batch Alpha, Batch Beta, Batch Gamma)
 * for any given age band code or label.
 */
export function getStudentGroupName(ageBandOrCode?: string | number | null): string {
  if (!ageBandOrCode) return 'Batch Beta';
  const str = String(ageBandOrCode).toLowerCase().trim();

  // Alpha: 7-10 or alpha
  if (
    str.includes('7-10') ||
    str.includes('7–10') ||
    str.includes('7 - 10') ||
    str.includes('below 11') ||
    str.includes('ab-1') ||
    str.includes('primary') ||
    str.includes('alpha')
  ) {
    return 'Batch Alpha';
  }

  // Gamma: 15-20, 16-20 or above 15
  if (
    str.includes('15-20') ||
    str.includes('15–20') ||
    str.includes('15 - 20') ||
    str.includes('16-20') ||
    str.includes('16–20') ||
    str.includes('16 - 20') ||
    str.includes('above 15') ||
    str.includes('ab-3') ||
    str.includes('transition') ||
    str.includes('secondary') ||
    str.includes('gamma') ||
    str.includes('gama')
  ) {
    return 'Batch Gamma';
  }

  // Beta: 11-15 (default intermediate)
  if (
    str.includes('11-15') ||
    str.includes('11–15') ||
    str.includes('11 - 15') ||
    str.includes('ab-2') ||
    str.includes('middle') ||
    str.includes('beta')
  ) {
    return 'Batch Beta';
  }

  return 'Batch Beta';
}

export const BATCH_RANK: Record<string, number> = {
  'Batch Alpha': 1,
  'Batch Beta': 2,
  'Batch Gamma': 3,
};

/**
 * Checks if a course is visible for a student's batch.
 * Students can see all courses of their own batch as well as all higher batches.
 * (e.g. Batch Beta student sees Batch Beta and Batch Gamma courses).
 */
export function isCourseVisibleForBatch(courseBatchOrCode?: string | null, studentBatchOrCode?: string | null): boolean {
  if (!studentBatchOrCode) return true;
  const courseTrack = formatStudentTrack(courseBatchOrCode);
  if (courseTrack === 'All Batches') return true;

  const courseBatch = getStudentGroupName(courseBatchOrCode);
  const studentBatch = getStudentGroupName(studentBatchOrCode);

  const courseRank = BATCH_RANK[courseBatch] || 1;
  const studentRank = BATCH_RANK[studentBatch] || 1;

  // Show course if course rank is equal to or higher than student's batch rank
  return courseRank >= studentRank;
}

/**
 * Formats a course card badge or track label for student sections.
 */
export function formatStudentTrack(labelOrCode?: string | null): string {
  if (!labelOrCode) return 'All Batches';
  const str = String(labelOrCode).trim();
  if (str.toLowerCase() === 'all ages' || str.toLowerCase() === 'all' || str.toLowerCase() === 'all groups' || str.toLowerCase() === 'all batches') {
    return 'All Batches';
  }
  return getStudentGroupName(str);
}

/**
 * Sanitizes backend explanation strings or descriptions for student sections,
 * transforming numerical age ranges into inspiring batch names.
 */
export function sanitizeStudentText(text?: string | null): string {
  if (!text) return '';
  return text
    .replace(/Ages?\s*(7\s*[-–]\s*10)/gi, 'Batch Alpha')
    .replace(/Ages?\s*(11\s*[-–]\s*15)/gi, 'Batch Beta')
    .replace(/Ages?\s*(1[56]\s*[-–]\s*20)/gi, 'Batch Gamma')
    .replace(/Below 11 years?/gi, 'Batch Alpha')
    .replace(/11\s*[-–]\s*15\s*years?/gi, 'Batch Beta')
    .replace(/Above 15 years?/gi, 'Batch Gamma')
    .replace(/Group\s*Alpha/gi, 'Batch Alpha')
    .replace(/Group\s*Beta/gi, 'Batch Beta')
    .replace(/Group\s*Gamma/gi, 'Batch Gamma')
    .replace(/Group\s*Gama/gi, 'Batch Gamma')
    .replace(/\b7\s*[-–]\s*10\b/g, 'Alpha')
    .replace(/\b11\s*[-–]\s*15\b/g, 'Beta')
    .replace(/\b1[56]\s*[-–]\s*20\b/g, 'Gamma')
    .replace(/learning\s*groups?/gi, 'learning batches')
    .replace(/learning\s*tracks?/gi, 'batch')
    .replace(/age\s*groups?/gi, 'batches')
    .replace(/age\s*bands?/gi, 'batches');
}
