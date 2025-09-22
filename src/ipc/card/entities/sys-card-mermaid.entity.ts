import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { BaseIdEntity } from '../../../common/entities/baseId.entities';
@Entity('sys_card_mermaid')
export class SysCardMermaidEntity extends BaseIdEntity {

  @Column({ type: 'text', nullable: false, name: 'card_id' })
  cardId!: string;

  @Column({ type: 'text', nullable: true })
  content?: any;
} 