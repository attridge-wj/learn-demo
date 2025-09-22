export interface CreateSpaceDto {
  spaceName: string;
  description?: string;
  type?: string;
  cover?: string;
  enabled?: number;
  status?: number;
  userList?: number[];
}

export interface UpdateSpaceDto extends Partial<CreateSpaceDto> {
  id: string;
}

export interface QuerySpaceDto {
  spaceName?: string;
  enabled?: number;
  status?: number;
  page?: number;
  pageSize?: number;
}

export interface SpaceUserDto {
  id: number;
  username: string;
  nickname: string;
  avatar: string;
}
