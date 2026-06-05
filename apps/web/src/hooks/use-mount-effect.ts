import { useEffect } from "react";

export function useMountEffect(effect: () => void | (() => void)) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only
  useEffect(effect, []);
}
