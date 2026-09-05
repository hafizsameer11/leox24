type TranslationTree = Record<string, unknown>;

export function mergeTranslations(
  base: TranslationTree,
  extension: TranslationTree
): TranslationTree {
  const result: TranslationTree = { ...base };

  for (const [key, value] of Object.entries(extension)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      result[key] &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key])
    ) {
      result[key] = mergeTranslations(
        result[key] as TranslationTree,
        value as TranslationTree
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}
