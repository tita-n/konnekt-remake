import { accentCssVars } from "@/lib/domain/color";
import { AUTH_STEPS, UNIVERSITIES } from "./index-shared";
import { DirectionA } from "./direction-a";
import { DirectionB } from "./direction-b";
import { DirectionC } from "./direction-c";
import { DirectionControls } from "./preview-controls";
import type { AuthDirection, AuthStepId } from "./steps";
import type { ScreenState } from "./frame-parts";
import "./directions.css";

const DIRECTIONS = { a: DirectionA, b: DirectionB, c: DirectionC } as const;
const SCREEN_STATES: Array<{ id: ScreenState; label: string }> = [
  { id: "ok", label: "Ready" },
  { id: "loading", label: "Loading" },
  { id: "error", label: "Request failed" },
  { id: "offline", label: "Offline" },
];
const STEP_OPTIONS = AUTH_STEPS.map((entry) => ({ id: entry.id as string, label: entry.label }));
const STATE_OPTIONS = SCREEN_STATES.map((entry) => ({ id: entry.id as string, label: entry.label }));
const CAMPUS_OPTIONS = UNIVERSITIES.map((entry) => ({ id: entry.id, label: entry.shortName }));

function pick<T extends { id: string }>(options: T[], id: string | undefined, fallback: T): T {
  return options.find((option) => option.id === id) ?? fallback;
}

/**
 * Resolves the requested step, theme, campus, screen state and brand state, then
 * renders the direction. It is a server component on purpose: the reused auth
 * forms must be bound to their real server actions the way the live pages bind
 * them, and no mock, stub or bypass is introduced anywhere in the preview.
 */
export function AuthDirectionFrame({
  direction,
  step,
  theme,
  universityId,
  state,
  brand,
  chrome = true,
}: {
  direction: AuthDirection;
  step?: string;
  theme?: string;
  universityId?: string;
  state?: string;
  brand?: string;
  chrome?: boolean;
}) {
  const current = pick(AUTH_STEPS, step, AUTH_STEPS[0]!);
  const mode = theme === "dark" ? "dark" : "light";
  const screenState = pick(SCREEN_STATES, state, SCREEN_STATES[0]!).id;
  const university = pick(UNIVERSITIES, universityId, UNIVERSITIES[0]!);
  const branded = brand === "campus" ? true : brand === "platform" ? false : current.branded;
  const accent = branded ? university.accentColor : "#4f46e5";
  const Direction = DIRECTIONS[direction] ?? DirectionA;

  return (
    <div data-theme={mode} style={accentCssVars(accent) as React.CSSProperties} className="auth-dir min-h-dvh bg-bg text-fg">
      <main id="main">
        <Direction step={current.id as AuthStepId} university={university} branded={branded} state={screenState} />
      </main>
      {chrome ? (
        <DirectionControls
          direction={direction}
          step={current.id}
          steps={STEP_OPTIONS}
          theme={mode}
          state={screenState}
          states={STATE_OPTIONS}
          university={university}
          universities={CAMPUS_OPTIONS}
          branded={branded}
          brand={branded ? "campus" : "platform"}
        />
      ) : null}
    </div>
  );
}
