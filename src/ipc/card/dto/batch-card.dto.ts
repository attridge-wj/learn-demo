import { CreateCardDto } from './create-card.dto'
import { UpdateCardDto } from './update-card.dto'

export interface BatchCreateCardDto {
  cards: CreateCardDto[];
}

export interface BatchDeleteCardDto {
  ids: string[];
  isPd: boolean;
}

export interface BatchUpdateCardDto {
  cards: UpdateCardDto[];
} 