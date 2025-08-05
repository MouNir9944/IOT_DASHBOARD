import NextAuth from "next-auth"

declare module "next-auth" {
  interface User {
    token?: string
    role?: string
    id?: string
  }

  interface Session {
    accessToken?: string
    user: {
      name?: string | null
      email?: string | null
      image?: string | null
      role?: string
      id?: string
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string
    role?: string
  }
} 