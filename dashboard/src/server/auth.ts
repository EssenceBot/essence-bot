import DiscordProvider from "@auth/core/providers/discord";
import type { SolidAuthConfig } from "@solid-mediakit/auth/src/index";

// make type that extends params.session

export const authOptions: SolidAuthConfig = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID as string,
      clientSecret: process.env.DISCORD_CLIENT_SECRET as string,
      token: "https://discord.com/api/oauth2/token",
      authorization:
        "https://discord.com/api/oauth2/authorize?scope=identify+email+guilds",
    })
  ],
  callbacks: {
    async jwt({ token, account }){
      if (account){
        token.access_token = account.access_token
      }
      return token;
    },
    async session({ session, token, user }) {
      session.accessToken = token.access_token
      return session;
    },
    
  }
};
