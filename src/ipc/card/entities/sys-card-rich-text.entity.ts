import { Entity, Column, PrimaryGeneratedColumn, OneToOne, JoinColumn, Index } from 'typeorm';
import { BaseIdEntity } from '../../../common/entities/baseId.entities';
import { SysCardBaseEntity } from './sys-card-base.entity'
@Entity('sys_card_rich_text')
@Index(['cardId'], { unique: true })
export class SysCardRichTextEntity extends BaseIdEntity {

  @Column({ type: 'text', nullable: false, name: 'card_id' })
  cardId!: string;

  @Column({ type: 'text', nullable: true })
  content!: string;

  @OneToOne(() => SysCardBaseEntity, card => card.cardInfo)
  @JoinColumn({ name: 'card_id' }) // 显式指定外键列名
  card!: SysCardBaseEntity;
} 