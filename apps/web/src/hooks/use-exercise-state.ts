import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useRef,
} from "react";

type ExerciseState = {
  sql: string;
  visibleHints: number;
  showSolution: boolean;
};

type ExerciseStateMap = Map<string, ExerciseState>;

type ExerciseStateContextValue = {
  getState: (exerciseId: string) => ExerciseState;
  saveState: (exerciseId: string, state: ExerciseState) => void;
};

const ExerciseStateContext = createContext<ExerciseStateContextValue | null>(
  null,
);

function createDefaultState(): ExerciseState {
  return { sql: "", visibleHints: 0, showSolution: false };
}

export function ExerciseStateProvider({ children }: { children: ReactNode }) {
  const stateMapRef = useRef<ExerciseStateMap>(new Map());

  const getState = useCallback((exerciseId: string): ExerciseState => {
    return stateMapRef.current.get(exerciseId) ?? createDefaultState();
  }, []);

  const saveState = useCallback((exerciseId: string, state: ExerciseState) => {
    stateMapRef.current.set(exerciseId, state);
  }, []);

  return createElement(
    ExerciseStateContext.Provider,
    { value: { getState, saveState } },
    children,
  );
}

export function useExerciseState() {
  const ctx = useContext(ExerciseStateContext);
  if (!ctx)
    throw new Error(
      "useExerciseState must be used within ExerciseStateProvider",
    );
  return ctx;
}
