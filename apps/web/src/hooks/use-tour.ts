import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";

const TOUR_STORAGE_KEY = "bdd-revision-tour-completed";

type TourStep = {
  target: string;
  title: string;
  content: string;
  position: "top" | "bottom" | "left" | "right";
};

export const tourSteps: TourStep[] = [
  {
    target: "[data-tour=welcome]",
    title: "Welcome to BDD Revision!",
    content:
      "Practice SQL exercises from the DZTelecom database. 26 exercises across 5 parts, with hints, solutions, and instant validation. Let's take a quick tour.",
    position: "bottom",
  },
  {
    target: "[data-tour=sidebar]",
    title: "Exercise Navigation",
    content:
      "Browse all 26 exercises grouped by part. Completed exercises show a green checkmark. The progress bar tracks your overall completion.",
    position: "right",
  },
  {
    target: "[data-tour=help-buttons]",
    title: "Question & Help",
    content:
      "Read the exercise question below and use these buttons: yellow Hint for progressive clues, red Solution as a last resort, or Database Schema to explore tables and relationships.",
    position: "bottom",
  },
  {
    target: "[data-tour=editor]",
    title: "SQL Editor",
    content:
      "Write your SQL queries here with syntax highlighting. Run tests your query against the database. Submit validates your answer. Ctrl+Enter runs, Ctrl+Shift+Enter submits.",
    position: "top",
  },
  {
    target: "[data-tour=results]",
    title: "Results & Feedback",
    content:
      "Run output shows your query results in a table. Submit shows pass/fail with detailed feedback — column mismatches, row count differences, or data diffs.",
    position: "top",
  },
  {
    target: "[data-tour=sandbox]",
    title: "Sandbox Mode",
    content:
      "Try SQL freely without an exercise. Exploration queries are rollback-safe, and database resets are restricted to maintenance.",
    position: "top",
  },
  {
    target: "[data-tour=github]",
    title: "Enjoying BDD Revision?",
    content:
      "If this app helps you with your revisions, a star on GitHub would mean a lot! It helps others discover the project too.",
    position: "bottom",
  },
  {
    target: "[data-tour=welcome]",
    title: "You're Ready!",
    content:
      "Start with Exercise 1.1 — creating the CUSTOMER table. Good luck with your revisions!",
    position: "bottom",
  },
];

type TourContextValue = {
  isActive: boolean;
  currentStep: number;
  steps: TourStep[];
  start: () => void;
  next: () => void;
  prev: () => void;
  finish: () => void;
};

const TourContext = createContext<TourContextValue | null>(null);

function wasTourCompleted() {
  try {
    return localStorage.getItem(TOUR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function TourProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const start = useCallback(() => {
    setIsActive(true);
    setCurrentStep(0);
  }, []);

  const next = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev >= tourSteps.length - 1) return prev;
      return prev + 1;
    });
  }, []);

  const prev = useCallback(() => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  }, []);

  const finish = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
  }, []);

  const value: TourContextValue = {
    isActive,
    currentStep,
    steps: tourSteps,
    start,
    next,
    prev,
    finish,
  };

  return createElement(TourContext.Provider, { value }, children);
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within TourProvider");
  return ctx;
}

export function shouldAutoStartTour() {
  return !wasTourCompleted();
}
