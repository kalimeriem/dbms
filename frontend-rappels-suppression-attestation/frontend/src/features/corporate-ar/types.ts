export const DESIGNATIONS = [
  "Équipement",
  "Maintenance",
  "Déviation fibre optique",
  "Liaison spécialisée",
  "Canalisation",
  "Pose câble",
  "Raccordement fibre optique",
] as const;

export const OBSERVATIONS = [
  "À jour",
  "Client inconnu",
  "Non payé",
  "Dossier remis à la SAJ",
  "Facture remise",
  "Décédé",
] as const;

/** Sentinel value of the <select> when the user wants to type their own text. */
export const AUTRE = "__autre__";

export interface CorporateFile {
  id: string;
  name: string;
  type: string;
  size: number;
  blob: Blob;
}

export interface CorporateClient {
  /** Primary key, generated automatically (CAR-000001…) — never typed by hand. */
  code: string;
  name: string;
  creance: number;
  /** Optional. */
  numeroFacture: string;
  /** Optional, ISO yyyy-mm-dd or "". */
  dateFacture: string;
  designation: string; // one of DESIGNATIONS or free text
  observation: string; // one of OBSERVATIONS or free text
  files: CorporateFile[];
}

/** A client before it has received its key. */
export type CorporateInput = Omit<CorporateClient, "code">;
