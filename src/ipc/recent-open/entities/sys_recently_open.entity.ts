import { Column, Entity, PrimaryColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entities';

@Entity('sys_recently_open', {
  comment: '最近打开记录表',
})
export class RecentlyOpenEntity extends BaseEntity {
  @Column({ type: 'text', name: 'space_id', nullable: true, comment: '空间ID' })
  spaceId!: string;

  @Column({ type: 'text', name: 'card_id', nullable: true, comment: '卡片ID' })
  cardId!: string;
} 