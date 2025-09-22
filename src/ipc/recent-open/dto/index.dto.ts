export interface CreateRecentlyOpenDto {
  spaceId: string;
  cardId: string;
}

export interface QueryRecentlyOpenDto {
  spaceId?: string;
}

export interface RecentlyOpenIdsDto {
  ids: string[];
} 