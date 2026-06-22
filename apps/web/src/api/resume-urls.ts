import { API_BASE_URL } from "./base-url";

export function resumePdfUrl(resumeId: string, updatedAt: string | Date): string {
  return `${API_BASE_URL}/api/resumes/${resumeId}/pdf?v=${new Date(updatedAt).getTime()}`;
}

export function variantPdfUrl(variantId: string, updatedAt: string | Date): string {
  return `${API_BASE_URL}/api/resumes/variants/${variantId}/pdf?v=${new Date(updatedAt).getTime()}`;
}
