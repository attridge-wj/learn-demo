export interface QueryCardDto {
  cardType?: string;
  subType?: string;
  spaceId?: string;
  boxId?: string;
  text?: string;
  name?: string;
  tagIds?: string;
  tagId?: string;
  extraData?: string;
  keyword?: string;
  startDate?: string;
  endDate?: string;
  markNumber?: number;
  sortType?: string;
  isCollect?: string;
  sourceId?: string;
}

export interface QueryCardPageDto {
  cardType?: string;
  subType?: string;
  spaceId?: string;
  boxId?: string;
  text?: string;
  name?: string;
  tagIds?: string;
  tagId?: string;
  extraData?: string;
  keyword?: string;
  startDate?: string;
  endDate?: string;
  sortType?: string;
  markNumber?: number;
  relateId?: string;
  isCollect?: string;
  sourceId?: string;
}

export interface QueryCardByDateDto {
  date?: string;
  spaceId?: string;
  cardType?: string;
}

