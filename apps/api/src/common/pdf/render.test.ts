import { renderResumePdf } from "./render";
import { expect, test } from "bun:test";

test("renders Greek resume content with embedded Unicode font", async () => {
  const pdf = await renderResumePdf({
    basics: {
      name: "Mohammad Abdali",
      headline: "Επαγγελματίας Ηλεκτρολογικής Συντήρησης",
      email: "mohamad.abdali8692@gmail.com",
    },
    summary: "Εμπειρία στην ηλεκτρολογική συντήρηση και διάγνωση βλαβών.",
    experience: [
      {
        company: "Τεχνικές Υπηρεσίες Κτιρίων",
        title: "Ηλεκτροτεχνικός",
        start: "2023",
        end: "2025",
        bullets: ["Εγκατάσταση, επιθεώρηση και επισκευή ηλεκτρικών συστημάτων."],
      },
    ],
    projects: [],
    skills: [{ group: "Ηλεκτρολογική Συντήρηση", items: ["Διάγνωση βλαβών"] }],
    education: [],
    publications: [],
    awards: [],
    certifications: [],
    sections: [],
  });

  expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  expect(pdf.byteLength).toBeGreaterThan(2_000);
});

test("renders English resume content with the same registered font family", async () => {
  const pdf = await renderResumePdf({
    basics: { name: "Mohammad Abdali", headline: "Electrical Maintenance Technician" },
    summary: "Hands-on electrical maintenance, troubleshooting and repair experience.",
    experience: [],
    projects: [],
    skills: [],
    education: [],
    publications: [],
    awards: [],
    certifications: [],
    sections: [],
  });

  expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  expect(pdf.byteLength).toBeGreaterThan(1_000);
});
