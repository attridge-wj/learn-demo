import { Column, Entity, PrimaryColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entities';

@Entity('sys_space', {
  comment: '空间表',
})
export class SpaceEntity extends BaseEntity {

  @Column({ type: 'text', name: 'space_name', nullable: false, comment: '空间名称' })
  spaceName!: string;

  @Column({ type: 'text', name: 'description', default: '', comment: '空间描述' })
  description!: string;

  @Column({ type: 'text', name: 'type', default: '0', comment: '空间类型 0 个人空间 1 团队空间' })
  type!: string;

  @Column({ type: 'text', nullable: true, comment: '空间logo' })
  cover!: string;

  @Column({ type: 'integer', name: 'enabled', default: 1, comment: '是否可用：0-不可用，1-可用' })
  enabled!: number;

  @Column({ type: 'integer', default: 1, comment: '空间状态：0-禁用，1-启用' })
  status!: number;
}
