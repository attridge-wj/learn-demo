export interface CreateCardBoxDto {
  id: string,
  name: string;
  spaceId: string;
  shareMode?: string;
  description?: string;
  password?: string;
  cover?: string;
  addLocation?: number;
  color?: string;
  type?: string;
}

export interface UpdateCardBoxDto {
  id?: string,
  name?: string;
  spaceId?: string;
  shareMode?: string;
  description?: string;
  password?: string;
  cover?: string;
  addLocation?: number;
  color?: string;
  type?: string;
}

export interface QueryCardBoxDto {
  name?: string;
  spaceId?: string;
  shareMode?: string;
  type?: string;
  addLocation?: number;
}

export interface CardBoxIdsDto {
  ids: string[];
} 