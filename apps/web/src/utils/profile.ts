interface ProfileIdentityFields {
  firstName: string;
  lastName: string;
}

/** True when both first and last name are blank — i.e. a draft profile row with no user input yet. */
export function isProfileEmpty(profile: ProfileIdentityFields): boolean {
  return profile.firstName.trim() === "" && profile.lastName.trim() === "";
}
