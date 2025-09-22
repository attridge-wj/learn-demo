import { Entity, Column, PrimaryGeneratedColumn, OneToOne, JoinColumn } from 'typeorm';
import { BaseIdEntity } from '../../../common/entities/baseId.entities';
import { SysCardBaseEntity } from './sys-card-base.entity';

@Entity('sys_card_drawboard')
export class SysCardDrawboardEntity extends BaseIdEntity {

  @Column({ type: 'text', nullable: false, name: 'card_id' })
  cardId!: string;

  @Column({ type: 'text', nullable: true })
  content?: any;

  @OneToOne(() => SysCardBaseEntity, card => card.drawboard)
  @JoinColumn({ name: 'card_id' }) 
  card!: SysCardBaseEntity;
} 