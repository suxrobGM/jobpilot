export function resumePdfUrl(resumeId: number, updatedAt: string): string {
  return `/api/resumes/${resumeId}/pdf?v=${new Date(updatedAt).getTime()}`;
}

export function variantPdfUrl(variantId: number, updatedAt: string): string {
  return `/api/resumes/variants/${variantId}/pdf?v=${new Date(updatedAt).getTime()}`;
}
