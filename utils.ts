// Utility functions

/**
 * Calculates the Levenshtein distance between two strings.
 * The Levenshtein distance is the minimum number of single-character edits
 * (insertions, deletions, or substitutions) required to change one word into the other.
 * @param s1 The first string.
 * @param s2 The second string.
 * @returns The Levenshtein distance.
 */
export function calculateLevenshteinDistance(s1: string, s2: string): number {
  // Ensure s1 is not shorter than s2 for this implementation's optimization path,
  // making s1 the (potentially) longer string or same length.
  if (s1.length < s2.length) {
    return calculateLevenshteinDistance(s2, s1);
  }

  // s1 is longer or same length as s2.
  if (s2.length === 0) {
    return s1.length; // If s2 is empty, all chars in s1 must be deleted/inserted.
  }

  const previousRow = Array.from({ length: s2.length + 1 }, (_, i) => i);

  for (let i = 0; i < s1.length; i++) {
    const s1Char = s1[i];
    const currentRow = [i + 1]; // First element is like deleting s1Char to match empty s2 prefix
    for (let j = 0; j < s2.length; j++) {
      const s2Char = s2[j];
      const insertions = previousRow[j + 1] + 1; 
      const deletions = currentRow[j] + 1;      
      const substitutions = previousRow[j] + (s1Char === s2Char ? 0 : 1);
      
      currentRow.push(Math.min(insertions, deletions, substitutions));
    }
    for(let k=0; k < previousRow.length; k++) {
        previousRow[k] = currentRow[k];
    }
  }

  return previousRow[s2.length];
}

/**
 * Calculates the similarity between a target string and a buffer string.
 * This version is tuned for finding the target within a buffer that might be longer
 * and contain extraneous text (e.g., previous verses).
 * @param targetText The target string (e.g., a Bible verse).
 * @param bufferTextToSearch The buffer string (e.g., recognized speech, possibly longer than target).
 * @returns Similarity percentage (0-100).
 */
export function calculateSimilarity(targetText: string, bufferTextToSearch: string): number {
  const L_target = targetText.length;
  const L_buffer = bufferTextToSearch.length;

  if (L_target === 0) return 100; // Convention: empty target is perfectly similar.
  if (L_buffer === 0 && L_target > 0) return 0; // Non-empty target cannot be found in empty buffer.

  // Calculate the Levenshtein distance between the target and the buffer.
  const distance = calculateLevenshteinDistance(targetText, bufferTextToSearch);

  // Estimate "coreEdits": edits pertaining to the target sequence within the buffer.
  // This attempts to subtract edits that are due to length differences if the buffer is longer.
  let coreEdits = distance - Math.max(0, L_buffer - L_target);
  coreEdits = Math.max(0, coreEdits); // Ensure coreEdits is not negative.

  // Similarity is calculated relative to the target's length.
  let similarityScore = ((L_target - coreEdits) / L_target) * 100;
  
  // If coreEdits exceed target length, it implies no meaningful match.
  if (coreEdits > L_target) {
    similarityScore = 0;
  }

  return Math.max(0, Math.min(100, similarityScore)); // Clamp result to 0-100 range.
}