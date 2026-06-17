export function resumePdfUrl(resumeId: string, updatedAt: string | Date): string {
  return `/api/resumes/${resumeId}/pdf?v=${new Date(updatedAt).getTime()}`;
}

export function variantPdfUrl(variantId: string, updatedAt: string | Date): string {
  return `/api/resumes/variants/${variantId}/pdf?v=${new Date(updatedAt).getTime()}`;
}
