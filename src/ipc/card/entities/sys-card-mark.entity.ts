import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { BaseIdEntity } from '../../../common/entities/baseId.entities';
@Entity('sys_card_mark')
export class SysCardMarkEntity extends BaseIdEntity {

  @Column({ type: 'text', nullable: false, name: 'card_id' })
  cardId!: string;

  @Column({ type: 'text', nullable: true })
  content?: any;
} 