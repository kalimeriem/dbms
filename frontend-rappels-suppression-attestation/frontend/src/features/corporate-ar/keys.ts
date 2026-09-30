/** Automatic primary keys: CAR-000001, CAR-000002… */
export const CODE_PREFIX = "CAR-";

export const formatCode = (n: number) => `${CODE_PREFIX}${String(n).padStart(6, "0")}`;

/** Numeric part of an auto-generated code, or 0 for any other (e.g. imported) code. */
export function codeNumber(code: string): number {
  const m = /^CAR-(\d+)$/i.exec(code.trim());
  return m ? Number(m[1]) : 0;
}
