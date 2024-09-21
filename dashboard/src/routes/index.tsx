import { createSession, signIn } from "@solid-mediakit/auth/client";
import { Navigate } from "@solidjs/router";
import { Show, createSignal, onCleanup } from "solid-js";
import "../app.css";

export default function Home() {
  const session = createSession();

  const [redirectIn, setRedirectIn] = createSignal(3);

  const int = setInterval(() => {
    setRedirectIn((prev) => prev - 1);
  }, 1000);

  onCleanup(() => clearInterval(int));

  return (
    <main>
      <h1>Home</h1>
      <Show
        when={session()}
        fallback={
          <>
            <span>You are not signed in.</span>
            <button onClick={() => signIn("discord")}>Sign In</button>
            <p class="bg-[#1da1f2]">Tailwind test</p>
          </>
        }
      >
        <span>Redirecting to protected page in {redirectIn()} seconds...</span>
        <Show when={redirectIn() <= 0}>
          <Navigate href="/protected" />
        </Show>
      </Show>
    </main>
  );
}
