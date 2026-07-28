import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { evaluatePassword } from "@/lib/password";

export function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground transition-colors hover:text-foreground"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

const BAR_TONE: Record<string, string> = {
  weak: "bg-destructive",
  medium: "bg-gold",
  good: "bg-gold",
  strong: "bg-primary",
};

export function PasswordStrengthMeter({ value }: { value: string }) {
  const s = evaluatePassword(value);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex h-1.5 flex-1 gap-1 overflow-hidden rounded-full">
          {[1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={cn(
                "h-full flex-1 rounded-full transition-all duration-300",
                i <= s.score ? BAR_TONE[s.tone] : "bg-muted",
              )}
            />
          ))}
        </div>
        <span className="w-24 text-right text-xs font-medium text-muted-foreground">{s.label}</span>
      </div>
      <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
        {s.checks.map((c) => (
          <li key={c.label} className={cn("transition-colors", c.ok && "text-primary")}>
            {c.ok ? "✓" : "•"} {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
