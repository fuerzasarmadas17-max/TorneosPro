import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

interface StepperProps {
  steps: { label: string }[];
  /** 1-based index of the current step */
  current: number;
  className?: string;
}

function Stepper({ steps, current, className }: StepperProps) {
  return (
    <div className={cn("flex items-start", className)}>
      {steps.map((step, i) => {
        const stepNum = i + 1;
        const isCompleted = stepNum < current;
        const isCurrent = stepNum === current;
        const isFirst = i === 0;
        const isLast = i === steps.length - 1;

        return (
          <div key={step.label} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              {/* left connector */}
              <div
                className={cn(
                  "h-0.5 flex-1",
                  isFirst
                    ? "invisible"
                    : stepNum <= current
                      ? "bg-primary"
                      : "bg-border"
                )}
              />
              <div
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors",
                  isCompleted && "bg-primary text-primary-foreground",
                  isCurrent &&
                    "bg-primary text-primary-foreground ring-2 ring-primary/30",
                  !isCompleted &&
                    !isCurrent &&
                    "border bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : stepNum}
              </div>
              {/* right connector */}
              <div
                className={cn(
                  "h-0.5 flex-1",
                  isLast
                    ? "invisible"
                    : stepNum < current
                      ? "bg-primary"
                      : "bg-border"
                )}
              />
            </div>
            <span
              className={cn(
                "mt-1.5 text-center text-xs",
                isCurrent
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export { Stepper };
