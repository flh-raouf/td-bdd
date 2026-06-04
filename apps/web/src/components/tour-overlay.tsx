import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTour } from "@/hooks/use-tour";
import { cn } from "@/lib/utils";

export function TourOverlay() {
  const { isActive, currentStep, steps, next, prev, finish } = useTour();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const frameRef = useRef<number>(0);

  const step = steps[currentStep];

  useEffect(() => {
    if (!isActive) {
      setTargetRect(null);
      return;
    }

    let attempts = 0;
    const maxAttempts = 20;

    const findTarget = () => {
      attempts++;
      const el = document.querySelector(step.target);
      if (el) {
        let rect: DOMRect | null = null;

        if (step.target === "[data-tour=question]") {
          const card = el.querySelector(".rounded-lg");
          if (card) rect = card.getBoundingClientRect();
        } else if (step.target === "[data-tour=editor]") {
          const editor = el.querySelector(".cm-editor");
          if (editor) rect = editor.getBoundingClientRect();
        } else if (step.target === "[data-tour=results]") {
          // Results area may be empty; highlight itself even if collapsed
          rect = el.getBoundingClientRect();
          if (rect.height < 20) {
            // Force a minimum height for the spotlight
            rect = new DOMRect(rect.x, rect.y, rect.width, 40);
          }
        } else {
          rect = el.getBoundingClientRect();
        }

        if (rect && rect.width > 0 && rect.height > 0) {
          setTargetRect(rect);
          return;
        }
      }

      if (attempts < maxAttempts) {
        frameRef.current = requestAnimationFrame(findTarget);
      } else {
        setTargetRect(null);
      }
    };

    frameRef.current = requestAnimationFrame(findTarget);

    return () => {
      cancelAnimationFrame(frameRef.current);
      setTargetRect(null);
    };
  }, [isActive, step.target]);

  const tooltipStyle = useMemo(() => {
    const maxWidth = 380;
    const gap = 16;

    // Center fallback when target not found
    if (!targetRect) {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    }

    let top = 0;
    let left = 0;

    switch (step.position) {
      case "bottom":
        top = targetRect.bottom + gap;
        left = targetRect.left + targetRect.width / 2 - maxWidth / 2;
        break;
      case "top": {
        top = targetRect.top - gap;
        left = targetRect.left + targetRect.width / 2 - maxWidth / 2;
        break;
      }
      case "right":
        top = targetRect.top + targetRect.height / 2;
        left = targetRect.right + gap;
        break;
      case "left":
        top = targetRect.top + targetRect.height / 2;
        left = targetRect.left - maxWidth - gap;
        break;
    }

    // Clamp to viewport
    left = Math.max(16, Math.min(left, window.innerWidth - maxWidth - 16));
    top = Math.max(16, Math.min(top, window.innerHeight - 200));

    const transform =
      step.position === "top"
        ? "translateY(-100%)"
        : step.position === "right" || step.position === "left"
          ? "translateY(-50%)"
          : undefined;

    return { top, left, transform };
  }, [targetRect, step.position]);

  if (!isActive) return null;

  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Spotlight overlay */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.x - 8}
                y={targetRect.y - 8}
                width={targetRect.width + 16}
                height={targetRect.height + 16}
                rx={8}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="black"
          fillOpacity={0.65}
          mask="url(#tour-mask)"
        />
        {targetRect && (
          <rect
            x={targetRect.x - 8}
            y={targetRect.y - 8}
            width={targetRect.width + 16}
            height={targetRect.height + 16}
            rx={8}
            fill="none"
            stroke="#58a6ff"
            strokeWidth={2}
          />
        )}
      </svg>

      {/* Tooltip */}
      <div
        className={cn(
          "absolute z-[101] w-[380px] rounded-lg border border-border bg-card p-5 shadow-2xl",
          !targetRect && "text-center",
        )}
        style={tooltipStyle ?? undefined}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="mb-0.5 text-xs font-medium text-accent">
              Step {currentStep + 1} of {steps.length}
            </p>
            <h3 className="text-base font-semibold">{step.title}</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={finish}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
          {step.content}
        </p>

        {step.target === "[data-tour=github]" && (
          <a
            href="https://github.com/flh-raouf/td-bdd"
            target="_blank"
            rel="noopener noreferrer"
            className="mb-5 flex items-center justify-center gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-4 py-2.5 text-sm font-medium text-yellow-400 no-underline transition-colors hover:bg-yellow-500/20"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden="true"
            >
              <title>GitHub</title>
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            Star us on GitHub
          </a>
        )}

        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === currentStep ? "w-4 bg-accent" : "w-1.5 bg-border",
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button variant="ghost" size="sm" onClick={prev}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
            )}
            {isLast ? (
              <Button
                size="sm"
                onClick={finish}
                className="bg-accent text-accent-foreground hover:opacity-90"
              >
                Let's go!
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={next}
                className="bg-accent text-accent-foreground hover:opacity-90"
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
