export interface CreateWebBookmarkDto {
  id: string;
  name: string;
  url?: string;
  description?: string;
  parentId?: string;
  category: string; // 'directory' | 'bookmark'
  spaceId: string;
}

export interface UpdateWebBookmarkDto {
  id?: string;
  name?: string;
  url?: string;
  description?: string;
  parentId?: string;
  category?: string;
  spaceId?: string;
}

export interface QueryWebBookmarkDto {
  name?: string;
  parentId?: string;
  category?: string;
  spaceId?: string;
}

export interface WebBookmarkIdsDto {
  ids: string[];
}
