import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { BaseIdEntity } from '../../../common/entities/baseId.entities';
@Entity('sys_card_multi_table')
export class SysCardMultiTableEntity extends BaseIdEntity {

  @Column({ type: 'text', nullable: false, name: 'card_id' })
  cardId!: string;

  @Column({ type: 'text', nullable: true })
  content!: string;

  @Column({ type: 'text', nullable: true })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Column({ type: 'text', nullable: true })
  data?: any;

  @Column({ type: 'text', nullable: true })
  attrList?: any;

  @Column({ type: 'text', nullable: true })
  viewList?: any;

  @Column({ type: 'text', nullable: true })
  currentViewId?: string;

  @Column({ type: 'text', nullable: true })
  relationTableId?: string;
} 