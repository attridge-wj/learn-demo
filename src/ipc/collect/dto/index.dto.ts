export interface CreateCollectDto {
  id?: string;
  spaceId: string;
  cardId?: string;
  directoryId?: string;
  cardType?: string;
  subType?: string;
  name: string;
  url?: string;
  isFolder?: number;
  sortOrder?: string;
}

export interface UpdateCollectDto extends Partial<CreateCollectDto> {
  id: string;
}

export interface QueryCollectDto {
  spaceId?: string;
  cardId?: string;
  directoryId?: string;
  cardType?: string;
  subType?: string;
  name?: string;
  url?: string;
  isFolder?: number;
  sortOrder?: string;
}

export interface CollectIdsDto {
  ids: string[];
}

export interface GetCardIdsByTypeDto {
  cardTypes: string | string[];
  spaceId?: string;
} 