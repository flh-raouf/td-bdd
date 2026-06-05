import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "bdd-revision-progress";

export type CompletedExerciseStatus = "success" | "hinted" | "revealed";

type ProgressData = {
  completedExercises: string[];
  lastExerciseId: string | null;
  hintedExerciseIds: string[];
  revealedExerciseIds: string[];
  completedExerciseStatuses: Record<string, CompletedExerciseStatus>;
};

type ProgressContextValue = ProgressData & {
  completed: string[];
  markComplete: (exerciseId: string, status?: CompletedExerciseStatus) => void;
  markHintUsed: (exerciseId: string) => void;
  markSolutionRevealed: (exerciseId: string) => void;
  reset: () => void;
};

const ProgressContext = createContext<ProgressContextValue | null>(null);

const emptyProgress = (): ProgressData => ({
  completedExercises: [],
  lastExerciseId: null,
  hintedExerciseIds: [],
  revealedExerciseIds: [],
  completedExerciseStatuses: {},
});

function stringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function completedStatusMap(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, CompletedExerciseStatus] => {
        const [exerciseId, status] = entry;
        return (
          typeof exerciseId === "string" &&
          (status === "success" || status === "hinted" || status === "revealed")
        );
      },
    ),
  );
}

function loadProgress(): ProgressData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        completedExercises: stringArray(parsed.completedExercises),
        lastExerciseId:
          typeof parsed.lastExerciseId === "string"
            ? parsed.lastExerciseId
            : null,
        hintedExerciseIds: stringArray(parsed.hintedExerciseIds),
        revealedExerciseIds: stringArray(parsed.revealedExerciseIds),
        completedExerciseStatuses: completedStatusMap(
          parsed.completedExerciseStatuses,
        ),
      };
    }
  } catch {
    // Corrupt or inaccessible localStorage should not block practice.
  }
  return emptyProgress();
}

function saveProgress(data: ProgressData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn("Unable to save progress to localStorage.", error);
  }
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ProgressData>(() => loadProgress());

  const markComplete = useCallback(
    (exerciseId: string, status: CompletedExerciseStatus = "success") => {
      setData((prev) => {
        if (prev.completedExercises.includes(exerciseId)) return prev;
        const next = {
          ...prev,
          completedExercises: [...prev.completedExercises, exerciseId],
          completedExerciseStatuses: {
            ...prev.completedExerciseStatuses,
            [exerciseId]: status,
          },
          lastExerciseId: exerciseId,
        };
        saveProgress(next);
        return next;
      });
    },
    [],
  );

  const markHintUsed = useCallback((exerciseId: string) => {
    setData((prev) => {
      if (prev.hintedExerciseIds.includes(exerciseId)) return prev;
      const next = {
        ...prev,
        hintedExerciseIds: [...prev.hintedExerciseIds, exerciseId],
      };
      saveProgress(next);
      return next;
    });
  }, []);

  const markSolutionRevealed = useCallback((exerciseId: string) => {
    setData((prev) => {
      if (prev.revealedExerciseIds.includes(exerciseId)) return prev;
      const next = {
        ...prev,
        revealedExerciseIds: [...prev.revealedExerciseIds, exerciseId],
      };
      saveProgress(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    saveProgress(emptyProgress());
    window.location.reload();
  }, []);

  const ctxValue: ProgressContextValue = useMemo(
    () => ({
      ...data,
      completed: data.completedExercises,
      markComplete,
      markHintUsed,
      markSolutionRevealed,
      reset,
    }),
    [data, markComplete, markHintUsed, markSolutionRevealed, reset],
  );

  return createElement(ProgressContext.Provider, { value: ctxValue }, children);
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useProgress must be used within ProgressProvider");
  return ctx;
}
