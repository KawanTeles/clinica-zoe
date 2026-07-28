export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  tone: "weak" | "medium" | "good" | "strong";
  checks: { label: string; ok: boolean }[];
  valid: boolean;
};

export function evaluatePassword(pass: string): PasswordStrength {
  const checks = [
    { label: "Mínimo de 8 caracteres", ok: pass.length >= 8 },
    { label: "Letra maiúscula", ok: /[A-Z]/.test(pass) },
    { label: "Letra minúscula", ok: /[a-z]/.test(pass) },
    { label: "Número", ok: /\d/.test(pass) },
    { label: "Símbolo (!@#$...)", ok: /[^A-Za-z0-9]/.test(pass) },
  ];
  const passed = checks.filter((c) => c.ok).length;
  const valid = checks.slice(0, 4).every((c) => c.ok);

  let score: PasswordStrength["score"] = 0;
  if (pass.length === 0) score = 0;
  else if (passed <= 2) score = 1;
  else if (passed === 3) score = 2;
  else if (passed === 4) score = 3;
  else score = 4;

  const map = {
    0: { label: "—", tone: "weak" as const },
    1: { label: "Muito fraca", tone: "weak" as const },
    2: { label: "Fraca", tone: "weak" as const },
    3: { label: "Boa", tone: "good" as const },
    4: { label: "Forte", tone: "strong" as const },
  };

  return { score, label: map[score].label, tone: map[score].tone, checks, valid };
}
