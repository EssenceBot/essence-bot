import { createSession, signOut } from "@solid-mediakit/auth/client";
import { action, createAsync } from "@solidjs/router";
import { Show, For, createSignal } from "solid-js";

type Guild = {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: number;
  permissions_new: string;
  features: string[];
};

export default function Protected() {
  const session = createSession();
  // const [accessToken, setAccessToken] = createSignal("");
  // if (session()) {
  //   setAccessToken(session().accessToken);
  // }
  // const guilds = createAsync(async (accessToken) => {
  //   const response = async () =>
  //     fetch("https://discord.com/api/users/@me/guilds", {
  //       headers: {
  //         Authorization: `Bearer ${accessToken}`,
  //       },
  //     });
  //   const guilds = await response().then((res) => res.json());
  //   return guilds;
  // });

  // const guilds = createAsync(async () => {
  //   if (session()) {
  //     const accessToken = session().accessToken;
  //     const response = async () =>
  //       fetch("https://discord.com/api/users/@me/guilds", {
  //         headers: {
  //           Authorization: `Bearer ${accessToken}`,
  //         },
  //       });
  //     const guilds: Array<Guild> = await response().then((res) => res.json());
  //     console.log(guilds);
  //     return guilds;
  //   }
  // });

  const getGuilds = async (session: any) => {
    "use server";
    const response = async () =>
      fetch("https://discord.com/api/users/@me/guilds", {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      });
    const guilds: Array<Guild> = await response().then((res) => res.json());
    return guilds;
  };
  const guilds = createAsync(async () => {
    if (session()) {
      return getGuilds(session());
    }
  });

  return (
    <Show
      when={session()}
      fallback={<p>Only shown for logged in users</p>}
      keyed
    >
      {(us) => (
        <main>
          <h1>Protected</h1>
          {us.user?.image ? <img src={us.user?.image} /> : null}
          <span>Hey there {us.user?.name}! You are signed in!</span>
          <Show when={guilds()}>
            <For each={guilds()}>
              {(guild) => (
                <span>
                  {guild.name}: {guild.id}
                </span>
              )}
            </For>
          </Show>

          <button
            onClick={() =>
              void signOut({
                redirectTo: "/",
                redirect: true,
              })
            }
          >
            Sign Out
          </button>
        </main>
      )}
    </Show>
  );
}
