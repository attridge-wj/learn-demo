import { Column, Entity, Index } from 'typeorm';
import { BaseIdEntity } from '../../../common/entities/baseId.entities';
@Entity('sys_card_relation')
@Index(['parentId'])
@Index(['subId'])
@Index(['parentId', 'subId'])
@Index(['spaceId'])
export class SysCardRelationEntity extends BaseIdEntity {
  @Column({ type: 'text', nullable: false, name: 'parent_id', primary: true })
  parentId!: string;

  @Column({ type: 'text', nullable: false, name: 'sub_id', primary: true })
  subId!: string;

  @Column({ type: 'text', nullable: true, name: 'space_id' })
  spaceId!: string;
} 