
export interface CreateTagDto {
  id?: string;
  name: string;
  type?: string;
  spaceId?: string;
  color?: string;
  addLocation?: number;
  isTop?: string;
  parentId?: string;
  parentName?: string;
  level?: number;
  sortOrder?: string;
}

export interface UpdateTagDto extends Partial<CreateTagDto> {
  id: string;
}

export interface QueryTagDto {
  type?: string;
  name?: string;
  spaceId?: string;
  parentId?: string;
  level?: number;
  sortOrder?: string;
}

export interface TagIdsDto {
  ids: string[];
}