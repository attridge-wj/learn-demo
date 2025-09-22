import { Column, Entity, PrimaryColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entities';

@Entity('sys_tag', {
  comment: '标签表',
})
export class TagEntity extends BaseEntity {
  @Column({ type: 'text', nullable: true, comment: '标签类型' })
  type!: string;

  @Column({ type: 'text', nullable: true, comment: '标签名称' })
  name!: string;

  @Column({ type: 'text', name: 'space_id', nullable: true, comment: '空间ID' })
  spaceId!: string;

  @Column({ type: 'text', nullable: true, comment: '标签颜色' })
  color!: string;

  @Column({ type: 'integer', name: 'add_location', nullable: true, comment: '添加位置：0-本地，1-云端' })
  addLocation!: number;

  @Column({ type: 'text', name: 'is_top', nullable: true, comment: '是否置顶：0-否，1-是' })
  isTop!: string;

  @Column({ type: 'text', name: 'parent_id', nullable: true, comment: '父标签ID' })
  parentId!: string;

  @Column({ type: 'text', name: 'parent_name', nullable: true, comment: '父标签名称' })
  parentName!: string;

  @Column({ type: 'integer', nullable: true, comment: '标签层级：0-顶级，1-一级子标签，2-二级子标签...' })
  level!: number;

  @Column({ type: 'text', name: 'sort_order', default: '0', comment: '排序路径' })
  sortOrder!: string;
} 