import type { UserUpdateInput } from "@jobpilot/contracts/user";
import type { UserAggregateResponse } from "@/api/types";

/** The saved profile as form values, so a full-profile PUT never resets fields the form doesn't show. */
export function toProfileFormValues(data: UserAggregateResponse): UserUpdateInput {
  const p = data.user;
  return {
    firstName: p.firstName,
    lastName: p.lastName,
    contactEmail: p.contactEmail,
    phone: p.phone ?? "",
    website: p.website ?? "",
    linkedin: p.linkedin ?? "",
    github: p.github ?? "",
    street: p.street ?? "",
    aptUnit: p.aptUnit ?? "",
    city: p.city ?? "",
    state: p.state ?? "",
    zipCode: p.zipCode ?? "",
    country: p.country ?? "",
    usAuthorized: p.usAuthorized,
    requiresSponsorship: p.requiresSponsorship,
    visaStatus: p.visaStatus ?? "",
    optExtension: p.optExtension ?? "",
    willingToRelocate: p.willingToRelocate,
    preferredLocations: p.preferredLocations,
    references: p.references.map((r) => ({
      name: r.name,
      relationship: r.relationship ?? "",
      company: r.company ?? "",
      email: r.email ?? "",
      phone: r.phone ?? "",
    })),
    salaryPreferences: p.salaryPreferences.map((s) => ({
      appliesTo: s.appliesTo,
      minAmount: s.minAmount ?? undefined,
      maxAmount: s.maxAmount ?? undefined,
      currency: s.currency,
      period: s.period,
    })),
    eeoGender: p.eeoGender ?? "",
    eeoRace: p.eeoRace ?? "",
    eeoEthnicity: p.eeoEthnicity ?? "",
    eeoHispanicOrLatino: p.eeoHispanicOrLatino ?? "",
    eeoVeteranStatus: p.eeoVeteranStatus ?? "",
    eeoDisabilityStatus: p.eeoDisabilityStatus ?? "",
    primaryResumeId: p.primaryResumeId,
  };
}
