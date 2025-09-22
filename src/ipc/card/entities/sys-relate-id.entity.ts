import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { BaseIdEntity } from '../../../common/entities/baseId.entities';
@Entity('sys_relate_id')
export class SysRelateIdEntity extends BaseIdEntity {

  @Column({ type: 'text', nullable: false, name: 'card_id' })
  cardId!: string;

  @Column({ type: 'text', nullable: false, name: 'relate_id' })
  relateId!: string;
}