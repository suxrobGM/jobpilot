import type { ResumeData } from "@jobpilot/contracts/resume";
import { Font, renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { CoverLetterTemplate } from "./cover-letter-template";
import { JakeTemplate } from "./jake-template";

// Helvetica's built-in PDF font does not contain Greek glyphs. Ship an OFL licensed
// Unicode font with the API so the same renderer works in local and container builds.
Font.register({
  family: "JobPilot Lato",
  fonts: [
    { src: new URL("../../../assets/fonts/Lato-Regular.ttf", import.meta.url).href },
    {
      src: new URL("../../../assets/fonts/Lato-Bold.ttf", import.meta.url).href,
      fontWeight: "bold",
    },
    {
      src: new URL("../../../assets/fonts/Lato-Italic.ttf", import.meta.url).href,
      fontStyle: "italic",
    },
  ],
});

export async function renderResumePdf(data: ResumeData): Promise<Buffer> {
  const element = createElement(JakeTemplate, { data });
  // @ts-expect-error - @react-pdf's Document typing is loose at the element seam.
  return renderToBuffer(element);
}

export async function renderCoverLetterPdf(text: string): Promise<Buffer> {
  const element = createElement(CoverLetterTemplate, { text });
  // @ts-expect-error - @react-pdf's Document typing is loose at the element seam.
  return renderToBuffer(element);
}
