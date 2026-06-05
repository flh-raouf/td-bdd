import { sql } from "@codemirror/lang-sql";
import { Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { forwardRef, useMemo } from "react";
import { ShineBorder } from "@/components/ui/shine-border";
import { useTheme } from "@/hooks/use-theme";
import { modKey } from "@/lib/platform";

function Key({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center rounded-sm border px-1 py-0.5 font-mono text-xs leading-none opacity-50">
      {children}
    </kbd>
  );
}

type SqlEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onRun: () => void;
  isSubmitting: boolean;
  isRunning: boolean;
  hideRun?: boolean;
  hideSubmit?: boolean;
  "data-tour"?: string;
};

export const SqlEditor = forwardRef<ReactCodeMirrorRef, SqlEditorProps>(
  function SqlEditor(
    {
      value,
      onChange,
      onSubmit,
      onRun,
      isSubmitting,
      isRunning,
      hideRun,
      hideSubmit,
      "data-tour": dataTour,
    },
    ref,
  ) {
    const { theme } = useTheme();
    const shortcutExtensions = useMemo(
      () => [
        Prec.highest(
          keymap.of([
            {
              key: "Mod-Enter",
              run: () => {
                if (hideRun) {
                  return true;
                }
                onRun();
                return true;
              },
            },
            {
              key: "Mod-Shift-Enter",
              run: () => {
                onSubmit();
                return true;
              },
            },
          ]),
        ),
      ],
      [hideRun, onRun, onSubmit],
    );

    return (
      <div className="flex flex-col" role="application" data-tour={dataTour}>
        <div className="relative rounded-md border border-border overflow-hidden">
          <CodeMirror
            ref={ref}
            value={value}
            onChange={onChange}
            extensions={[sql(), ...shortcutExtensions]}
            theme={theme}
            height="240px"
            basicSetup={{
              lineNumbers: true,
              bracketMatching: true,
              closeBrackets: true,
              autocompletion: true,
            }}
          />
          <ShineBorder
            className="z-10 opacity-50"
            borderWidth={1}
            shineColor={["#A07CFE", "#FE8FB5", "#FFBE7B"]}
          />
        </div>
        <div className="mt-3 flex items-center gap-2">
          {!hideRun && (
            <button
              type="button"
              onClick={onRun}
              disabled={isRunning || isSubmitting}
              className="inline-flex h-8 items-center gap-2 rounded-md bg-card border border-border px-4 text-sm font-medium text-foreground hover:bg-sidebar-hover disabled:opacity-50"
            >
              {isRunning ? "Running..." : "Run"}
              <span className="inline-flex items-center gap-0.5">
                <Key>{modKey()}</Key>+<Key>Enter</Key>
              </span>
            </button>
          )}
          {!hideSubmit && (
            <button
              type="button"
              onClick={onSubmit}
              disabled={isRunning || isSubmitting}
              className="inline-flex h-8 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? "Checking..." : "Submit"}
              <span className="inline-flex items-center gap-0.5">
                <Key>{modKey()}</Key>+<Key>Shift</Key>+<Key>Enter</Key>
              </span>
            </button>
          )}
        </div>
      </div>
    );
  },
);
