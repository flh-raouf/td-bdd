import { Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  DatabaseBackup,
  KeyRound,
  LogOut,
  Shield,
  XCircle,
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { ErrorState, LoadingState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";

type ExerciseStat = {
  hints: number;
  solutions: number;
  submitCorrect: number;
  submitIncorrect: number;
};

const emptyStat: ExerciseStat = {
  hints: 0,
  solutions: 0,
  submitCorrect: 0,
  submitIncorrect: 0,
};

export function AdminPage() {
  const utils = trpc.useUtils();
  const [password, setPassword] = useState("");
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [reseedMessage, setReseedMessage] = useState<string | null>(null);

  const meQuery = trpc.admin.me.useQuery();
  const isAuthenticated = meQuery.data?.authenticated ?? false;
  const exercisesQuery = trpc.exercises.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const statsQuery = trpc.admin.stats.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const loginMutation = trpc.admin.login.useMutation({
    onSuccess: async () => {
      setPassword("");
      setLoginError(null);
      await Promise.all([
        utils.admin.me.invalidate(),
        utils.admin.stats.invalidate(),
        utils.exercises.list.invalidate(),
      ]);
    },
    onError: (error) => {
      setLoginError(error.message);
    },
  });

  const logoutMutation = trpc.admin.logout.useMutation({
    onSuccess: async () => {
      setSelectedExerciseId("");
      await Promise.all([
        utils.admin.me.invalidate(),
        utils.admin.stats.invalidate(),
      ]);
    },
  });

  const reseedMutation = trpc.admin.reseed.useMutation({
    onSuccess: () => {
      setReseedMessage("Database reseeded successfully.");
    },
    onError: (error) => {
      setReseedMessage(error.message);
    },
  });

  const exercises = exercisesQuery.data ?? [];
  const activeExerciseId = selectedExerciseId || exercises[0]?.id || "";
  const activeExercise = exercises.find(
    (exercise) => exercise.id === activeExerciseId,
  );
  const exerciseStats =
    statsQuery.data?.exerciseStats[activeExerciseId] ?? emptyStat;
  const totalSubmits =
    exerciseStats.submitCorrect + exerciseStats.submitIncorrect;
  const successRate =
    totalSubmits > 0
      ? Math.round((exerciseStats.submitCorrect / totalSubmits) * 100)
      : 0;

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    loginMutation.mutate({ password });
  };

  if (meQuery.isLoading) {
    return (
      <div className="flex min-h-screen w-screen items-center justify-center bg-background">
        <LoadingState label="Loading admin..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen w-screen items-center justify-center bg-background px-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg"
        >
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-accent/40 bg-accent/10 text-accent">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Admin</h1>
              <p className="text-sm text-muted-foreground">Password required</p>
            </div>
          </div>

          <label className="mb-2 block text-sm font-medium" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mb-4 h-10 w-full rounded-md border border-border bg-background px-3 font-mono text-sm outline-none transition-colors focus:border-accent"
            autoComplete="current-password"
          />

          {loginError && (
            <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-red-400">
              {loginError}
            </p>
          )}

          <Button
            type="submit"
            className="w-full gap-2"
            disabled={loginMutation.isPending || password.length === 0}
          >
            <Shield className="h-4 w-4" />
            {loginMutation.isPending ? "Checking..." : "Enter admin"}
          </Button>
        </form>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen w-screen items-center justify-center bg-background px-4 py-5">
      <div className="flex w-full max-w-6xl flex-col gap-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              to="/"
              className="mb-2 inline-flex text-sm text-muted-foreground no-underline hover:text-foreground"
            >
              Back to exercises
            </Link>
            <h1 className="text-2xl font-semibold">Admin</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </header>

        <section className="grid gap-4 md:grid-cols-[220px_1fr]">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 text-sm text-muted-foreground">Unique IPs</div>
            <div className="font-mono text-4xl font-semibold text-accent">
              {statsQuery.data?.uniqueIpCount ?? 0}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Exercise engagement</h2>
                <p className="text-sm text-muted-foreground">
                  {activeExercise?.title ?? "No exercise selected"}
                </p>
              </div>
              <select
                value={activeExerciseId}
                onChange={(event) => setSelectedExerciseId(event.target.value)}
                className="h-9 min-w-56 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent"
              >
                {exercises.map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.id} - {exercise.title}
                  </option>
                ))}
              </select>
            </div>

            {statsQuery.isLoading || exercisesQuery.isLoading ? (
              <LoadingState label="Loading stats..." />
            ) : statsQuery.isError ? (
              <ErrorState title="Stats failed" error={statsQuery.error} />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <StatTile label="Hints" value={exerciseStats.hints} />
                <StatTile label="Solutions" value={exerciseStats.solutions} />
                <StatTile
                  label="Correct"
                  value={exerciseStats.submitCorrect}
                  icon={<CheckCircle2 className="h-4 w-4 text-success" />}
                />
                <StatTile
                  label="Incorrect"
                  value={exerciseStats.submitIncorrect}
                  icon={<XCircle className="h-4 w-4 text-destructive" />}
                />
                <StatTile label="Success rate" value={`${successRate}%`} />
              </div>
            )}
          </div>
        </section>

        <Separator />

        <section className="rounded-lg border border-border bg-card p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Maintenance</h2>
              <p className="text-sm text-muted-foreground">
                Reset the DZTelecom exercise database.
              </p>
            </div>
            <Button
              variant="destructive"
              className="gap-2"
              onClick={() => reseedMutation.mutate()}
              disabled={reseedMutation.isPending}
            >
              <DatabaseBackup className="h-4 w-4" />
              {reseedMutation.isPending ? "Reseeding..." : "Reseed database"}
            </Button>
          </div>

          {reseedMessage && (
            <p className="rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
              {reseedMessage}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

function StatTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="mb-2 flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <div className="font-mono text-2xl font-semibold">{value}</div>
    </div>
  );
}
