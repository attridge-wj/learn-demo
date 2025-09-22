export interface StatisticsQueryDto {
  spaceId?: string;
}

export interface StatisticsResponseDto {
  cardCount: number;
  cardSetCount: number;
  diaryCount: number;
  markCount: number;
  tagCount: number;
  attachmentCount: number;
} 