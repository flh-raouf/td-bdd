import { useCallback, useMemo } from "react";

const STORAGE_KEY = "bdd-revision-progress";

type ProgressData = {
  completedExercises: string[];
  lastExerciseId: string | null;
};

function loadProgress(): ProgressData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        completedExercises: Array.isArray(parsed.completedExercises)
          ? parsed.completedExercises
          : [],
        lastExerciseId:
          typeof parsed.lastExerciseId === "string"
            ? parsed.lastExerciseId
            : null,
      };
    }
  } catch {
    // ignore corrupted data
  }

  return { completedExercises: [], lastExerciseId: null };
}

function saveProgress(data: ProgressData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useProgress() {
  const data = useMemo(() => loadProgress(), []);

  const markComplete = useCallback((exerciseId: string) => {
    const current = loadProgress();
    if (!current.completedExercises.includes(exerciseId)) {
      current.completedExercises.push(exerciseId);
    }
    current.lastExerciseId = exerciseId;
    saveProgress(current);
  }, []);

  const reset = useCallback(() => {
    saveProgress({ completedExercises: [], lastExerciseId: null });
  }, []);

  return {
    completed: data.completedExercises,
    lastExerciseId: data.lastExerciseId,
    markComplete,
    reset,
  };
}
