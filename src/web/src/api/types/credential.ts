export interface CredentialDto {
  id: number;
  scope: string;
  email: string | null;
  password: string | null;
  apiKey: string | null;
}
