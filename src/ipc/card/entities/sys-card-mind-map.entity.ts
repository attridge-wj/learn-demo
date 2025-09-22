import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { BaseIdEntity } from '../../../common/entities/baseId.entities';
import { SysCardBaseEntity } from './sys-card-base.entity';

@Entity('sys_card_mind_map')
export class SysCardMindMapEntity extends BaseIdEntity {

  @Column({ type: 'text', nullable: false, name: 'card_id' })
  cardId!: string;

  @Column({ type: 'text', nullable: true })
  content!: string;

  @Column({ type: 'text', nullable: true })
  cardMap?: any;

  @OneToOne(() => SysCardBaseEntity, card => card.mindMap)
  @JoinColumn({ name: 'card_id' }) // 显式指定外键列名
  card!: SysCardBaseEntity;
} 