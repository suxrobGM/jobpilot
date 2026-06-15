import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import type { ResumeData } from "@jobpilot/contracts/resume";
import { CoverLetterTemplate } from "./cover-letter-template";
import { JakeTemplate } from "./jake-template";

export async function renderResumePdf(data: ResumeData): Promise<Buffer> {
  const element = createElement(JakeTemplate, { data });
  // @ts-expect-error — @react-pdf's Document typing is loose at the element seam.
  return renderToBuffer(element);
}

export async function renderCoverLetterPdf(text: string): Promise<Buffer> {
  const element = createElement(CoverLetterTemplate, { text });
  // @ts-expect-error — @react-pdf's Document typing is loose at the element seam.
  return renderToBuffer(element);
}
