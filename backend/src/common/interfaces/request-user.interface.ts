import { UserRole } from '../enums';

export interface RequestUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: UserRole[];
}
