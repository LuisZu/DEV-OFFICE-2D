export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  DEVELOPER = 'DEVELOPER',
  VIEWER = 'VIEWER',
}

export interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
  roles: UserRole[]
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: AuthUser
}
